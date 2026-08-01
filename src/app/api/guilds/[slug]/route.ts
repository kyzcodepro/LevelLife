import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { activityTypes, feedReactions, logs, users } from "@/db/schema";
import { ensureObjective, guildDetail } from "@/lib/guildService";
import { apiUser } from "@/lib/session";

/** GET /api/guilds/:slug — guilde + membres + objectif + fil partagé (GLD-2/3). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { slug } = await params;
  const detail = await guildDetail(db, slug, user.id);
  if (!detail) {
    return NextResponse.json({ error: "Guilde introuvable" }, { status: 404 });
  }

  const objective = await ensureObjective(db, detail.guild.id, user.timezone);
  const progress = detail.members.reduce(
    (sum, m) => sum + m.membership.weeklyContribution,
    0,
  );

  // Fil : logs partagés opt-in des membres, réactions emoji uniquement.
  let feed: unknown[] = [];
  if (detail.isMember) {
    const memberIds = detail.members.map((m) => m.membership.userId);
    const feedRows = await db
      .select({
        log: logs,
        typeLabel: activityTypes.label,
        attributeCode: activityTypes.attributeCode,
        username: users.username,
      })
      .from(logs)
      .innerJoin(activityTypes, eq(logs.activityTypeId, activityTypes.id))
      .innerJoin(users, eq(logs.userId, users.id))
      .where(
        and(inArray(logs.userId, memberIds), eq(logs.visibility, "guild")),
      )
      .orderBy(desc(logs.occurredAt))
      .limit(30);

    const logIds = feedRows.map((r) => r.log.id);
    const reactions =
      logIds.length > 0
        ? await db
            .select()
            .from(feedReactions)
            .where(inArray(feedReactions.logId, logIds))
        : [];

    feed = feedRows.map((row) => ({
      ...row,
      reactions: reactions
        .filter((r) => r.logId === row.log.id)
        .map((r) => ({ emoji: r.emoji, userId: r.userId })),
    }));
  }

  return NextResponse.json({
    ...detail,
    objective: { ...objective, progress },
    feed,
    viewerId: user.id,
  });
}
