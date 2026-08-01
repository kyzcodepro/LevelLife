/**
 * AVA-5 — Succès / hauts faits : critères déclaratifs (jsonb) évalués après
 * un log, une quête, un check-in ou une adhésion. Idempotent (insert-only).
 */

import { and, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  achievements,
  checkins,
  guildMembers,
  leagueMembers,
  logs,
  lqiScores,
  questInstances,
  streaks,
  userAchievements,
  userAttributes,
  xpEvents,
} from "@/db/schema";
import { localDateStr } from "@/lib/dates";

export interface AchievementCriteria {
  type:
    | "logs_total"
    | "logs_one_day"
    | "attr_level"
    | "attrs_all_level"
    | "streak_best"
    | "quests_completed"
    | "checkins_total"
    | "lqi_above"
    | "active_attrs_week"
    | "guild_member"
    | "season_member";
  value?: number;
  attr?: string;
}

interface Aggregates {
  logsTotal: number;
  logsToday: number;
  levels: Map<string, number>;
  bestStreak: number;
  questsCompleted: number;
  checkinsTotal: number;
  bestLqi: number;
  activeAttrsWeek: number;
  inGuild: boolean;
  inSeason: boolean;
}

async function loadAggregates(
  db: Db,
  userId: string,
  timezone: string,
): Promise<Aggregates> {
  const now = new Date();
  const today = localDateStr(now, timezone);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [
    [{ logsTotal }],
    recentLogs,
    attrs,
    userStreaks,
    [{ questsCompleted }],
    [{ checkinsTotal }],
    scores,
    weekEvents,
    guild,
    league,
  ] = await Promise.all([
    db
      .select({ logsTotal: sql<number>`count(*)::int` })
      .from(logs)
      .where(eq(logs.userId, userId)),
    db
      .select({ occurredAt: logs.occurredAt })
      .from(logs)
      .where(
        and(
          eq(logs.userId, userId),
          gte(logs.occurredAt, new Date(now.getTime() - 36 * 3600 * 1000)),
        ),
      ),
    db.select().from(userAttributes).where(eq(userAttributes.userId, userId)),
    db.select().from(streaks).where(eq(streaks.userId, userId)),
    db
      .select({ questsCompleted: sql<number>`count(*)::int` })
      .from(questInstances)
      .where(
        and(
          eq(questInstances.userId, userId),
          eq(questInstances.status, "completed"),
        ),
      ),
    db
      .select({ checkinsTotal: sql<number>`count(*)::int` })
      .from(checkins)
      .where(eq(checkins.userId, userId)),
    db.select().from(lqiScores).where(eq(lqiScores.userId, userId)),
    db
      .select({ attributeCode: xpEvents.attributeCode })
      .from(xpEvents)
      .where(
        and(eq(xpEvents.userId, userId), gte(xpEvents.createdAt, sevenDaysAgo)),
      ),
    db
      .select()
      .from(guildMembers)
      .where(eq(guildMembers.userId, userId))
      .limit(1),
    db
      .select()
      .from(leagueMembers)
      .where(eq(leagueMembers.userId, userId))
      .limit(1),
  ]);

  return {
    logsTotal,
    logsToday: recentLogs.filter(
      (l) => localDateStr(l.occurredAt, timezone) === today,
    ).length,
    levels: new Map(attrs.map((a) => [a.attributeCode, a.level])),
    bestStreak: Math.max(0, ...userStreaks.map((s) => s.best)),
    questsCompleted,
    checkinsTotal,
    bestLqi: Math.max(0, ...scores.map((s) => Number(s.total))),
    activeAttrsWeek: new Set(weekEvents.map((e) => e.attributeCode)).size,
    inGuild: guild.length > 0,
    inSeason: league.length > 0,
  };
}

function met(criteria: AchievementCriteria, agg: Aggregates): boolean {
  const v = criteria.value ?? 1;
  switch (criteria.type) {
    case "logs_total":
      return agg.logsTotal >= v;
    case "logs_one_day":
      return agg.logsToday >= v;
    case "attr_level":
      return criteria.attr
        ? (agg.levels.get(criteria.attr) ?? 1) >= v
        : [...agg.levels.values()].some((l) => l >= v);
    case "attrs_all_level":
      return (
        agg.levels.size >= 8 && [...agg.levels.values()].every((l) => l >= v)
      );
    case "streak_best":
      return agg.bestStreak >= v;
    case "quests_completed":
      return agg.questsCompleted >= v;
    case "checkins_total":
      return agg.checkinsTotal >= v;
    case "lqi_above":
      return agg.bestLqi >= v;
    case "active_attrs_week":
      return agg.activeAttrsWeek >= v;
    case "guild_member":
      return agg.inGuild;
    case "season_member":
      return agg.inSeason;
    default:
      return false;
  }
}

/** Évalue tous les succès non débloqués ; retourne les nouveaux. */
export async function checkAchievements(
  db: Db,
  user: { id: string; timezone: string },
): Promise<{ code: string; title: string; rarity: string }[]> {
  const [all, unlockedRows] = await Promise.all([
    db.select().from(achievements),
    db
      .select({ achievementId: userAchievements.achievementId })
      .from(userAchievements)
      .where(eq(userAchievements.userId, user.id)),
  ]);
  const unlocked = new Set(unlockedRows.map((u) => u.achievementId));
  const pending = all.filter((a) => !unlocked.has(a.id));
  if (pending.length === 0) return [];

  const agg = await loadAggregates(db, user.id, user.timezone);
  const newly: { code: string; title: string; rarity: string }[] = [];

  for (const achievement of pending) {
    const criteria = achievement.criteria as AchievementCriteria | null;
    if (!criteria || !met(criteria, agg)) continue;
    await db
      .insert(userAchievements)
      .values({ userId: user.id, achievementId: achievement.id })
      .onConflictDoNothing();
    newly.push({
      code: achievement.code,
      title: achievement.title,
      rarity: achievement.rarity,
    });
  }
  return newly;
}
