import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { questInstances, quests } from "@/db/schema";
import type { AttributeCode } from "@/lib/attributes";
import { applyXpEvent } from "@/lib/logService";
import { apiUser } from "@/lib/session";

/**
 * POST /api/quests/:id/complete — complétion manuelle (quêtes target.manual
 * ou déclaratives). Les quêtes trackées se complètent automatiquement au log.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const [row] = await db
    .select({ instance: questInstances, quest: quests })
    .from(questInstances)
    .innerJoin(quests, eq(questInstances.questId, quests.id))
    .where(
      and(
        eq(questInstances.id, id),
        eq(questInstances.userId, user.id),
        eq(questInstances.status, "active"),
      ),
    );
  if (!row) {
    return NextResponse.json({ error: "Quête introuvable" }, { status: 404 });
  }

  const target = (row.quest.target ?? {}) as {
    attributeCode?: string;
    manual?: boolean;
  };
  if (!target.manual) {
    return NextResponse.json(
      { error: "Cette quête se complète automatiquement en loggant" },
      { status: 400 },
    );
  }

  const award = await db.transaction(async (tx) => {
    await tx
      .update(questInstances)
      .set({ status: "completed", completedAt: new Date() })
      .where(eq(questInstances.id, id));
    if (row.quest.xpReward > 0) {
      return applyXpEvent(tx, {
        userId: user.id,
        attributeCode: (target.attributeCode ?? "DIS") as AttributeCode,
        amount: row.quest.xpReward,
        reason: "quest",
      });
    }
    return null;
  });

  return NextResponse.json({ ok: true, award });
}
