import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityTypes, habits, logs } from "@/db/schema";
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

  const push = (t: (typeof all)[number] | undefined) => {
    if (t && items.length < n && !items.some((i) => i.id === t.id)) {
      items.push(t);
    }
  };

  // 1. Les habitudes suivies (favoris de l'onboarding) d'abord.
  const userHabits = await db
    .select({ activityTypeId: habits.activityTypeId })
    .from(habits)
    .where(and(eq(habits.userId, user.id), eq(habits.active, true)));
  for (const h of userHabits) push(byId.get(h.activityTypeId));

  // 2. Puis un tour par attribut pour la variété (round-robin).
  const byAttribute = new Map<string, (typeof all)[number][]>();
  for (const t of all) {
    const list = byAttribute.get(t.attributeCode) ?? [];
    list.push(t);
    byAttribute.set(t.attributeCode, list);
  }
  let added = true;
  while (items.length < n && added) {
    added = false;
    for (const list of byAttribute.values()) {
      const next = list.find((t) => !items.some((i) => i.id === t.id));
      if (next && items.length < n) {
        push(next);
        added = true;
      }
    }
  }

  return NextResponse.json({ items: items.slice(0, n) });
}
