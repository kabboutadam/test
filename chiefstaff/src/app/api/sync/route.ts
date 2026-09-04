import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { runPipeline } from "@/core/pipeline";

export const maxDuration = 300;

/**
 * On-demand sync for the signed-in executive. The scheduled morning run should
 * call this per user from a cron worker rather than fanning out here — one HTTP
 * request should not own an unbounded number of Claude calls.
 */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const connections = await db.connection.count({ where: { userId: user.id } });
  if (connections === 0) {
    return NextResponse.json({ error: "no sources connected" }, { status: 409 });
  }

  try {
    return NextResponse.json(await runPipeline(user));
  } catch (error) {
    console.error("sync failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "sync failed" },
      { status: 500 },
    );
  }
}
