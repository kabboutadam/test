import { PgBoss } from "pg-boss";
import { env } from "@/lib/env";

/**
 * Background work, on Postgres rather than Redis. The morning run fans out to
 * one expensive job per executive; doing that inside a request handler is what
 * breaks at the second customer.
 *
 * Two queues rather than one. A pipeline failure (Claude timed out, Google
 * rate-limited) must not take the delivery of an already-generated brief with
 * it, and delivery is cheap, idempotent and worth retrying far more times.
 */
export const QUEUES = {
  pipeline: "chiefstaff.pipeline",
  deliver: "chiefstaff.deliver",
} as const;

/**
 * `stately` is what makes `singletonKey` actually deduplicate: at most one job
 * per key per state, so an executive has one run waiting and at most one
 * running. On the default `standard` policy the key is recorded and ignored,
 * and a five-minute poll quietly queues twelve identical pipelines an hour.
 */
const POLICY = "stately" as const;

export interface PipelineJob {
  userId: string;
  /** Why this run was asked for — "schedule", "manual", … Shows up in job logs. */
  reason: string;
}

export interface DeliverJob {
  userId: string;
  briefId: string;
}

let instance: PgBoss | null = null;
let starting: Promise<PgBoss> | null = null;

/**
 * The shared pg-boss handle. `supervise` runs maintenance (archiving, expiry)
 * and belongs to the worker process only — a web dyno doing it as well means
 * two schedulers competing over the same tables.
 */
export async function queue(options: { supervise?: boolean } = {}): Promise<PgBoss> {
  if (instance) return instance;
  if (starting) return starting;

  starting = (async () => {
    const boss = new PgBoss({
      connectionString: env.databaseUrl,
      supervise: options.supervise ?? false,
      schedule: false,
    });

    boss.on("error", (error: unknown) => console.error("pg-boss:", error));
    await boss.start();

    // Queues must exist before anything can be sent to them. A queue's policy
    // is fixed at creation — pg-boss will not update it — so a queue left over
    // from an older build silently loses deduplication. Say so rather than
    // dropping it, which would take any queued jobs with it.
    for (const name of Object.values(QUEUES)) {
      await boss.createQueue(name, { policy: POLICY });

      const existing = await boss.getQueue(name);
      if (existing && existing.policy !== POLICY) {
        console.warn(
          `pg-boss: queue "${name}" has policy "${existing.policy}", expected "${POLICY}". ` +
            `Deduplication is off — drain it and run boss.deleteQueue(${JSON.stringify(name)}) to recreate.`,
        );
      }
    }

    instance = boss;
    return boss;
  })();

  return starting;
}

export async function stopQueue(): Promise<void> {
  if (!instance) return;
  await instance.stop({ graceful: true });
  instance = null;
  starting = null;
}

/**
 * Queue a pipeline run. Deduplicated on the executive: a five-minute poll, a
 * cron and someone hammering "Sync now" produce one pending job, not twelve.
 * Returns null when an identical job is already waiting — which is a success,
 * not a failure: the work the caller asked for is already coming.
 */
export async function enqueuePipeline(userId: string, reason: string): Promise<string | null> {
  const boss = await queue();
  return boss.send(
    QUEUES.pipeline,
    { userId, reason } satisfies PipelineJob,
    {
      singletonKey: `pipeline:${userId}`,
      // Google and Anthropic both fail transiently; backoff rather than
      // hammering a service that just told us it was busy.
      retryLimit: 2,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 900,
    },
  );
}

export async function enqueueDelivery(userId: string, briefId: string): Promise<string | null> {
  const boss = await queue();
  return boss.send(
    QUEUES.deliver,
    { userId, briefId } satisfies DeliverJob,
    {
      // Idempotent on Brief.deliveredAt, so retrying generously is safe and a
      // transient SMTP failure should never cost someone their brief.
      singletonKey: `deliver:${briefId}`,
      retryLimit: 8,
      retryDelay: 30,
      retryBackoff: true,
      expireInSeconds: 300,
    },
  );
}
