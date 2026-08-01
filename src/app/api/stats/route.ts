import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { xpEvents } from "@/db/schema";
import { localDateStr } from "@/lib/dates";
import { apiUser } from "@/lib/session";

/**
 * GET /api/stats?range=30d|90d|365d — séries temporelles pour graphiques :
 * XP par jour et par attribut (courbes) + total par jour (heatmap).
 */
export async function GET(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const range = req.nextUrl.searchParams.get("range") ?? "30d";
  const days = range === "365d" ? 365 : range === "90d" ? 90 : 30;
  const since = new Date(Date.now() - days * 24 * 3600 * 1000);

  const events = await db
    .select({
      amount: xpEvents.amount,
      attributeCode: xpEvents.attributeCode,
      createdAt: xpEvents.createdAt,
    })
    .from(xpEvents)
    .where(and(eq(xpEvents.userId, user.id), gte(xpEvents.createdAt, since)));

  const byDay = new Map<
    string,
    { total: number; byAttribute: Record<string, number> }
  >();
  for (const e of events) {
    const day = localDateStr(e.createdAt, user.timezone);
    const entry = byDay.get(day) ?? { total: 0, byAttribute: {} };
    entry.total += e.amount;
    entry.byAttribute[e.attributeCode] =
      (entry.byAttribute[e.attributeCode] ?? 0) + e.amount;
    byDay.set(day, entry);
  }

  const series = [...byDay.entries()]
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => a.day.localeCompare(b.day));

  return NextResponse.json({ range: `${days}d`, series });
}
