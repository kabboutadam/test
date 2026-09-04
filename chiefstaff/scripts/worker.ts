/**
 * The background worker: queue consumer plus the morning scheduler.
 *
 *   npm run worker                 consume jobs and schedule, forever
 *   npm run worker -- --once       one scheduler pass, drain, exit (cron)
 *   npm run worker -- --user dana@northwind.example
 *
 * Work is queued rather than run inline because the morning fans out to one
 * expensive job per executive, and a request handler owning N Claude calls
 * stops working at the second customer.
 *
 * Idempotent at three points, so a poll, a cron and a manual run can overlap:
 * a pending job for an executive collapses on its singleton key, a brief
 * already generated for today is not regenerated, and one already delivered is
 * not sent again.
 */
import { PrismaClient, type User } from "@prisma/client";
import { runPipeline } from "../src/core/pipeline";
import { briefForToday, deliverBrief } from "../src/core/deliver";
import { mailConfigured } from "../src/lib/mail";
import { isBriefDue, localClock } from "../src/lib/time";
import {
  QUEUES,
  enqueueDelivery,
  enqueuePipeline,
  queue,
  stopQueue,
  type DeliverJob,
  type PipelineJob,
} from "../src/jobs/queue";

const db = new PrismaClient();

interface Options {
  once: boolean;
  intervalMinutes: number;
  onlyUser?: string;
}

function parseArgs(argv: string[]): Options {
  const options: Options = { once: false, intervalMinutes: 5 };
  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1];
    if (argv[i] === "--once") options.once = true;
    if (argv[i] === "--interval" && value) options.intervalMinutes = Math.max(1, Number(value));
    if (argv[i] === "--user" && value) options.onlyUser = value.toLowerCase();
  }
  return options;
}

/** Jobs this process has queued and not yet finished. Drives --once draining. */
let outstanding = 0;

// ---------------------------------------------------------------- handlers

async function handlePipeline(data: PipelineJob): Promise<void> {
  const user = await db.user.findUnique({ where: { id: data.userId } });
  if (!user) return;

  const result = await runPipeline(user);
  console.log(
    `  ${user.email}: ${result.ingest.stored} new signals, ${result.triage.created} decisions, ` +
      `${result.loops.opened} loops opened (${data.reason})`,
  );

  const brief = await briefForToday(user);
  if (brief && !brief.deliveredAt) {
    outstanding++;
    await enqueueDelivery(user.id, brief.id);
  }
}

async function handleDeliver(data: DeliverJob): Promise<void> {
  const [user, brief] = await Promise.all([
    db.user.findUnique({ where: { id: data.userId } }),
    db.brief.findUnique({ where: { id: data.briefId } }),
  ]);
  if (!user || !brief) return;

  const delivery = await deliverBrief(user, brief);
  console.log(
    `  ${user.email}: ${delivery.delivered ? `brief delivered via ${delivery.channels.join(", ")}` : `not delivered — ${delivery.reason}`}`,
  );
}

// --------------------------------------------------------------- scheduler

/** Decide what, if anything, this executive needs right now. */
async function schedule(user: User, now: Date): Promise<string> {
  if (!isBriefDue(user, now)) {
    return `waiting — ${localClock(now, user.timezone)} local, brief at ${String(user.briefHour).padStart(2, "0")}:00`;
  }

  const brief = await briefForToday(user, now);

  if (brief?.deliveredAt) {
    return `done — delivered ${localClock(brief.deliveredAt, user.timezone)} local`;
  }

  // A brief that exists but never went out needs delivery, not another
  // pipeline run. Regenerating would pay for Claude twice for the same day.
  if (brief) {
    outstanding++;
    await enqueueDelivery(user.id, brief.id);
    return "queued delivery";
  }

  outstanding++;
  await enqueuePipeline(user.id, "schedule");
  return "queued pipeline";
}

async function tick(options: Options): Promise<void> {
  const now = new Date();
  const users = await db.user.findMany({
    where: options.onlyUser ? { email: options.onlyUser } : {},
    orderBy: { email: "asc" },
  });

  if (users.length === 0) {
    console.log(`${now.toISOString()}  no users`);
    return;
  }

  console.log(`${now.toISOString()}  checking ${users.length} executive(s)`);
  for (const user of users) {
    try {
      console.log(`  ${user.email}: ${await schedule(user, now)}`);
    } catch (error) {
      // One executive's failure must never stop another's brief.
      console.error(`  ${user.email}: FAILED — ${error instanceof Error ? error.message : error}`);
    }
  }
}

// -------------------------------------------------------------------- main

async function drain(timeoutMs = 15 * 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (outstanding > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (outstanding > 0) console.warn(`gave up waiting on ${outstanding} job(s)`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!mailConfigured()) {
    console.log("SMTP_URL is not set — briefs will be logged, not sent, and stay undelivered.\n");
  }

  // Only this process supervises: maintenance running in two places means two
  // schedulers competing over the same tables.
  const boss = await queue({ supervise: true });

  const consume =
    <T>(handler: (data: T) => Promise<void>) =>
    async (jobs: { data: T }[]) => {
      for (const job of jobs) {
        try {
          await handler(job.data);
        } catch (error) {
          // pg-boss records the error on the job and retries, but nobody
          // reads the job table at 6am. Say it here, then let it retry.
          console.error(`  job failed: ${error instanceof Error ? error.stack ?? error.message : error}`);
          throw error;
        } finally {
          // Decrement even on failure: pg-boss owns the retry, and --once
          // should not block on a job that will be picked up later.
          outstanding = Math.max(0, outstanding - 1);
        }
      }
    };

  await boss.work<PipelineJob>(
    QUEUES.pipeline,
    { batchSize: 1, pollingIntervalSeconds: 2 },
    consume(handlePipeline),
  );
  await boss.work<DeliverJob>(
    QUEUES.deliver,
    { batchSize: 5, pollingIntervalSeconds: 2 },
    consume(handleDeliver),
  );

  await tick(options);

  if (options.once) {
    await drain();
    await stopQueue();
    await db.$disconnect();
    return;
  }

  console.log(`\nworking queues, scheduling every ${options.intervalMinutes} minute(s). Ctrl-C to stop.`);
  setInterval(() => void tick(options), options.intervalMinutes * 60_000);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      console.log(`\n${signal} — finishing in-flight jobs`);
      void stopQueue().then(() => db.$disconnect()).then(() => process.exit(0));
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
