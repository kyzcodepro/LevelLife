import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityTypes, logs } from "@/db/schema";
import { apiUser } from "@/lib/session";

/**
 * GET /api/activity-types            → tous les types (système + custom de l'utilisateur)
 * GET /api/activity-types?frequent=8 → les N types les plus loggés sur 30 j,
 *                                      complétés par des types système (Quick Log).
 */
export async function GET(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const frequent = req.nextUrl.searchParams.get("frequent");

  const all = await db
    .select()
    .from(activityTypes)
    .where(
      or(isNull(activityTypes.userId), eq(activityTypes.userId, user.id)),
    )
    .orderBy(activityTypes.attributeCode, activityTypes.label);

  if (!frequent) return NextResponse.json({ items: all });

  const n = Math.min(12, Math.max(1, Number(frequent) || 8));
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const usage = await db
    .select({
      activityTypeId: logs.activityTypeId,
      count: sql<number>`count(*)::int`,
    })
    .from(logs)
    .where(and(eq(logs.userId, user.id), gte(logs.occurredAt, thirtyDaysAgo)))
    .groupBy(logs.activityTypeId)
    .orderBy(desc(sql`count(*)`))
    .limit(n);

  const byId = new Map(all.map((t) => [t.id, t]));
  const items = usage
    .map((u) => byId.get(u.activityTypeId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  // Complète avec des types système variés si moins de N utilisés.
  for (const t of all) {
    if (items.length >= n) break;
    if (!items.some((i) => i.id === t.id)) items.push(t);
  }

  return NextResponse.json({ items: items.slice(0, n) });
}
