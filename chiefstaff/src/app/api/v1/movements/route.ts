import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { authed, json } from "@/lib/api";
import { metricSeries } from "@/core/metrics";

export async function GET(request: NextRequest) {
  const auth = await authed(request);
  if ("response" in auth) return auth.response;

  const movements = await db.movement.findMany({
    where: { userId: auth.user.id, status: "open" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { metric: { include: { owner: true } } },
  });
  const sorted = movements.sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
  const series = await Promise.all(sorted.map((movement) => metricSeries(movement.metricId)));
  return json({
    movements: sorted.map((movement, index) => ({
        series: series[index],
        id: movement.id,
        sentence: movement.sentence,
        deviation: movement.deviation,
        periodStart: movement.periodStart.toISOString().slice(0, 10),
        metric: movement.metric.name,
        segment: movement.metric.segment,
        owner: movement.metric.owner ? { name: movement.metric.owner.name, email: movement.metric.owner.email } : null,
      })),
  });
}
