import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { feedReactions, logs } from "@/db/schema";
import { userGuild } from "@/lib/guildService";
import { apiUser } from "@/lib/session";

/** Réactions emoji uniquement — pas de commentaires libres en V1 (GLD-2). */
const ALLOWED_EMOJIS = ["🔥", "💪", "👏", "⚡", "🫡", "❤️"];

const schema = z.object({ emoji: z.string() });

/** POST /api/feed/:logId/react — toggle d'une réaction emoji. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ logId: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success || !ALLOWED_EMOJIS.includes(parsed.data.emoji)) {
    return NextResponse.json({ error: "Emoji non autorisé" }, { status: 400 });
  }

  const { logId } = await params;
  const [log] = await db.select().from(logs).where(eq(logs.id, logId));
  if (!log || log.visibility !== "guild") {
    return NextResponse.json({ error: "Log introuvable" }, { status: 404 });
  }

  // Même guilde que l'auteur, et pas mute.
  const [mine, theirs] = await Promise.all([
    userGuild(db, user.id),
    userGuild(db, log.userId),
  ]);
  if (!mine || !theirs || mine.guild.id !== theirs.guild.id) {
    return NextResponse.json({ error: "Pas dans la même guilde" }, { status: 403 });
  }
  if (mine.membership.muted) {
    return NextResponse.json({ error: "Tu es mute dans cette guilde" }, { status: 403 });
  }

  const existing = await db
    .select()
    .from(feedReactions)
    .where(
      and(
        eq(feedReactions.logId, logId),
        eq(feedReactions.userId, user.id),
        eq(feedReactions.emoji, parsed.data.emoji),
      ),
    );
  if (existing.length > 0) {
    await db
      .delete(feedReactions)
      .where(
        and(
          eq(feedReactions.logId, logId),
          eq(feedReactions.userId, user.id),
          eq(feedReactions.emoji, parsed.data.emoji),
        ),
      );
    return NextResponse.json({ ok: true, reacted: false });
  }
  await db
    .insert(feedReactions)
    .values({ logId, userId: user.id, emoji: parsed.data.emoji });
  return NextResponse.json({ ok: true, reacted: true });
}
