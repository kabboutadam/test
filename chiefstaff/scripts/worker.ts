/**
 * The morning run.
 *
 *   npm run worker              poll every 5 minutes
 *   npm run worker -- --once    a single pass, for cron
 *   npm run worker -- --user dana@northwind.example
 *
 * Each executive gets exactly one brief per local day. The work is idempotent
 * at two points — a brief already generated for today is not regenerated, and a
 * brief already delivered is not sent again — so running this on a five-minute
 * poll, a cron, and by hand at the same time is safe.
 */
import { PrismaClient, type User } from "@prisma/client";
import { runPipeline } from "../src/core/pipeline";
import { briefForToday, deliverBrief } from "../src/core/deliver";
import { mailConfigured } from "../src/lib/mail";
import { isBriefDue, localClock } from "../src/lib/time";

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

async function serve(user: User, now: Date): Promise<string> {
  const clock = localClock(now, user.timezone);

  if (!isBriefDue(user, now)) {
    return `waiting — ${clock} local, brief at ${String(user.briefHour).padStart(2, "0")}:00`;
  }

  let brief = await briefForToday(user, now);
  if (brief?.deliveredAt) return `done — delivered ${localClock(brief.deliveredAt, user.timezone)} local`;

  if (!brief) {
    const result = await runPipeline(user);
    brief = await briefForToday(user, now);
    if (!brief) return `no brief produced (${result.ingest.stored} new signals)`;
    console.log(
      `    pipeline: ${result.ingest.stored} new signals, ${result.triage.created} decisions, ` +
        `${result.loops.opened} loops opened`,
    );
  }

  const delivery = await deliverBrief(user, brief);
  return delivery.delivered ? `delivered to ${user.email}` : `not delivered — ${delivery.reason}`;
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
      console.log(`  ${user.email}: ${await serve(user, now)}`);
    } catch (error) {
      // One executive's failure must never stop the others' briefs.
      console.error(`  ${user.email}: FAILED — ${error instanceof Error ? error.message : error}`);
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!mailConfigured()) {
    console.log("SMTP_URL is not set — briefs will be logged, not sent, and stay undelivered.\n");
  }

  await tick(options);
  if (options.once) return;

  console.log(`\npolling every ${options.intervalMinutes} minute(s). Ctrl-C to stop.`);
  setInterval(() => void tick(options), options.intervalMinutes * 60_000);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
