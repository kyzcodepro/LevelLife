/**
 * M5 — L'Arène (ARN-1/2/4) : saisons de 3 mois, ligues fermées de 30 joueurs
 * de niveau proche. Jamais de classement mondial (PRD §11.2). L'XP total ne
 * reset jamais — seuls les points de saison repartent à zéro.
 */

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  leagueMembers,
  leagues,
  profiles,
  seasons,
  userAttributes,
  users,
} from "@/db/schema";
import { globalLevel } from "@/lib/xp";

export const LEAGUE_CAPACITY = 30;
/** Largeur des tranches de niveau global pour l'appariement. */
export const TIER_WIDTH = 5;

/** Saison trimestrielle courante — créée à la volée si absente. */
export async function currentSeason(db: Db) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(seasons)
    .where(and(sql`${seasons.startsAt} <= now()`, sql`${seasons.endsAt} > now()`));
  if (existing) return existing;

  const quarter = Math.floor(now.getUTCMonth() / 3);
  const startsAt = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3, 1));
  const endsAt = new Date(Date.UTC(now.getUTCFullYear(), quarter * 3 + 3, 1));
  const name = `Saison ${now.getUTCFullYear()}-Q${quarter + 1}`;
  const [created] = await db
    .insert(seasons)
    .values({ name, startsAt, endsAt, theme: null })
    .returning();
  return created;
}

async function userTier(db: Db, userId: string): Promise<number> {
  const [attrs, profile] = await Promise.all([
    db.select().from(userAttributes).where(eq(userAttributes.userId, userId)),
    db.query.profiles.findFirst({ where: eq(profiles.userId, userId) }),
  ]);
  const levels = Object.fromEntries(attrs.map((a) => [a.attributeCode, a.level]));
  const weights = (profile?.attributeWeights ?? {}) as Record<string, number>;
  return Math.floor(globalLevel(levels, weights) / TIER_WIDTH);
}

/** Adhésion à la ligue de la saison courante (opt-in), par niveau proche. */
export async function joinArena(
  db: Db,
  userId: string,
): Promise<{ ok: boolean; leagueId?: string }> {
  const season = await currentSeason(db);

  const [already] = await db
    .select({ member: leagueMembers, league: leagues })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
    .where(
      and(eq(leagueMembers.userId, userId), eq(leagues.seasonId, season.id)),
    );
  if (already) return { ok: true, leagueId: already.league.id };

  const tier = await userTier(db, userId);

  // Une ligue du bon palier avec de la place, sinon on en ouvre une.
  const candidates = await db
    .select({
      league: leagues,
      members: sql<number>`(select count(*)::int from league_members lm where lm.league_id = ${leagues.id})`,
    })
    .from(leagues)
    .where(and(eq(leagues.seasonId, season.id), eq(leagues.tier, tier)));
  let league = candidates.find((c) => c.members < LEAGUE_CAPACITY)?.league;
  if (!league) {
    [league] = await db
      .insert(leagues)
      .values({ seasonId: season.id, tier, capacity: LEAGUE_CAPACITY })
      .returning();
  }

  await db
    .insert(leagueMembers)
    .values({ leagueId: league.id, userId })
    .onConflictDoNothing();
  return { ok: true, leagueId: league.id };
}

/** Hook de createLog : les points de saison suivent l'XP gagné (si inscrit). */
export async function addSeasonPoints(
  tx: Db,
  userId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  const [row] = await tx
    .select({ member: leagueMembers, league: leagues, season: seasons })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
    .innerJoin(seasons, eq(leagues.seasonId, seasons.id))
    .where(
      and(
        eq(leagueMembers.userId, userId),
        sql`${seasons.startsAt} <= now()`,
        sql`${seasons.endsAt} > now()`,
      ),
    );
  if (!row) return;
  await tx
    .update(leagueMembers)
    .set({ points: sql`${leagueMembers.points} + ${amount}` })
    .where(
      and(
        eq(leagueMembers.leagueId, row.league.id),
        eq(leagueMembers.userId, userId),
      ),
    );
}

/** Classement de la ligue du joueur (30 max, jamais mondial). */
export async function leagueStandings(db: Db, userId: string) {
  const season = await currentSeason(db);
  const [membership] = await db
    .select({ member: leagueMembers, league: leagues })
    .from(leagueMembers)
    .innerJoin(leagues, eq(leagueMembers.leagueId, leagues.id))
    .where(
      and(eq(leagueMembers.userId, userId), eq(leagues.seasonId, season.id)),
    );
  if (!membership) return { season, league: null, standings: [] };

  const standings = await db
    .select({
      userId: leagueMembers.userId,
      points: leagueMembers.points,
      username: users.username,
    })
    .from(leagueMembers)
    .innerJoin(users, eq(leagueMembers.userId, users.id))
    .where(eq(leagueMembers.leagueId, membership.league.id))
    .orderBy(sql`points desc`);

  return { season, league: membership.league, standings };
}
