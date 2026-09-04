/**
 * Runs the full pipeline for every user with signals waiting. This is what the
 * morning cron calls; it is also the fastest way to see whether a prompt change
 * made triage better or worse.
 */
import { PrismaClient } from "@prisma/client";
import { runPipeline } from "../src/core/pipeline";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany();
  if (users.length === 0) {
    console.log("No users. Run `npm run seed` first.");
    return;
  }

  for (const user of users) {
    console.log(`\n=== ${user.email} ===`);
    const result = await runPipeline(user);
    console.log(JSON.stringify(result, null, 2));

    const brief = await db.brief.findFirst({
      where: { userId: user.id },
      orderBy: { forDate: "desc" },
    });
    if (brief) console.log(`\n${brief.markdown}\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
