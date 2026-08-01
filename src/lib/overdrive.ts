/**
 * Ticket 20 — Détecteur de sur-optimisation (règle anti-dérive, PRD §5.4 / §11.5) :
 * XP en hausse + LQI en baisse sur 3 semaines → on freine, on propose du repos,
 * on réduit le volume de quêtes. Le grind vide n'est jamais récompensé.
 */

import { desc, eq, gte, and } from "drizzle-orm";
import type { Db } from "@/db";
import { lqiScores, xpEvents } from "@/db/schema";
import { localDateStr, weekStartStr } from "@/lib/dates";

export interface WeeklySnapshot {
  weekStart: string;
  xp: number;
  lqi: number;
}

/**
 * Cœur pur : semaines ordonnées de la plus ancienne à la plus récente.
 * Signalé si, sur les 3 dernières semaines consécutives, l'XP monte
 * (strictement au global) pendant que le LQI descend.
 */
export function detectOverdriveCore(weeks: WeeklySnapshot[]): boolean {
  if (weeks.length < 3) return false;
  const last = weeks.slice(-3);
  const xpRising = last[2].xp > last[1].xp && last[1].xp > last[0].xp;
  const lqiFalling = last[2].lqi < last[1].lqi && last[1].lqi < last[0].lqi;
  return xpRising && lqiFalling;
}

export async function detectOverdrive(
  db: Db,
  userId: string,
  timezone: string,
): Promise<{ flagged: boolean; weeks: WeeklySnapshot[] }> {
  const scores = await db
    .select()
    .from(lqiScores)
    .where(eq(lqiScores.userId, userId))
    .orderBy(desc(lqiScores.weekStart))
    .limit(4);
  if (scores.length < 3) return { flagged: false, weeks: [] };

  const oldest = scores[scores.length - 1].weekStart;
  const events = await db
    .select({ amount: xpEvents.amount, createdAt: xpEvents.createdAt })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        gte(xpEvents.createdAt, new Date(`${oldest}T00:00:00Z`)),
      ),
    );

  const xpByWeek = new Map<string, number>();
  for (const e of events) {
    const week = weekStartStr(localDateStr(e.createdAt, timezone));
    xpByWeek.set(week, (xpByWeek.get(week) ?? 0) + e.amount);
  }

  const weeks: WeeklySnapshot[] = scores
    .map((s) => ({
      weekStart: s.weekStart,
      xp: xpByWeek.get(s.weekStart) ?? 0,
      lqi: Number(s.total),
    }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  return { flagged: detectOverdriveCore(weeks), weeks };
}
