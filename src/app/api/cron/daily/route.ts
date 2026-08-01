import { NextRequest, NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { streaks, users } from "@/db/schema";
import { localDateStr, shiftDateStr } from "@/lib/dates";
import { ensureQuests } from "@/lib/questEngine";

export const maxDuration = 300;

/**
 * Ticket 14 — Cron journalier (00:05, Vercel Cron / QStash) :
 * génération des quêtes du jour, expiration des périmées, vérification
 * des streaks cassés (le gel couvre un jour manqué isolé), recharge
 * mensuelle des gels Mode Repos.
 *
 * Protégé par CRON_SECRET (Authorization: Bearer <secret>).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const allUsers = await db
    .select()
    .from(users)
    .where(isNotNull(users.username));

  let questsGenerated = 0;
  let streaksReset = 0;

  for (const user of allUsers) {
    const today = localDateStr(new Date(), user.timezone);
    const yesterday = shiftDateStr(today, -1);
    const firstOfMonth = today.slice(0, 8) + "01";

    await ensureQuests(db, user);
    questsGenerated++;

    // Streaks cassés : dernier log avant hier ET pas assez de gels pour couvrir.
    const userStreaks = await db
      .select()
      .from(streaks)
      .where(eq(streaks.userId, user.id));
    for (const streak of userStreaks) {
      if (!streak.lastDoneOn || streak.current === 0) continue;
      // Recharge mensuelle des gels le 1er du mois.
      if (today === firstOfMonth && streak.freezesLeft < 2) {
        await db
          .update(streaks)
          .set({ freezesLeft: 2 })
          .where(eq(streaks.id, streak.id));
      }
      const gapCoveredByFreeze =
        streak.lastDoneOn === shiftDateStr(yesterday, -1) &&
        streak.freezesLeft > 0;
      const broken =
        streak.lastDoneOn < yesterday && !gapCoveredByFreeze;
      if (broken) {
        // Pas de streak-shaming : le total cumulé (lifetime_total) reste.
        await db
          .update(streaks)
          .set({ current: 0 })
          .where(eq(streaks.id, streak.id));
        streaksReset++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    users: allUsers.length,
    questsGenerated,
    streaksReset,
  });
}
