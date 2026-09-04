import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@/lib/session";
import { enqueuePipeline } from "@/jobs/queue";

/**
 * On-demand sync for the signed-in executive. Returns as soon as the job is
 * queued — one HTTP request should never own an unbounded number of Claude
 * calls. The worker picks it up; duplicates collapse on the singleton key.
 */
export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const connections = await db.connection.count({ where: { userId: user.id } });
  if (connections === 0) {
    return NextResponse.json({ error: "no sources connected" }, { status: 409 });
  }

  try {
    const jobId = await enqueuePipeline(user.id, "api");
    // A null id means an identical job is already pending, which is a success
    // from the caller's point of view: the work they asked for is coming.
    return NextResponse.json({ queued: true, jobId }, { status: 202 });
  } catch (error) {
    console.error("failed to queue sync", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "could not queue sync" },
      { status: 500 },
    );
  }
}
