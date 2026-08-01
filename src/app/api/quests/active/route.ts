import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { questInstances, quests } from "@/db/schema";
import { ensureQuests } from "@/lib/questEngine";
import { apiUser } from "@/lib/session";

/** GET /api/quests/active — quêtes actives + progression (génération paresseuse). */
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  await ensureQuests(db, user);

  const rows = await db
    .select({ instance: questInstances, quest: quests })
    .from(questInstances)
    .innerJoin(quests, eq(questInstances.questId, quests.id))
    .where(
      and(
        eq(questInstances.userId, user.id),
        inArray(questInstances.status, ["active", "completed"]),
      ),
    )
    .orderBy(quests.scope, questInstances.assignedAt);

  return NextResponse.json({ items: rows });
}
