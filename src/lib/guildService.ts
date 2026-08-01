/**
 * M4 — Guildes (GLD-1/2/3/6) : création, adhésion (3-30 membres), objectif
 * collectif hebdomadaire, contribution au log, modération (kick/mute).
 */

import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  guildMembers,
  guildObjectives,
  guilds,
  users,
} from "@/db/schema";
import { localDateStr, weekStartStr } from "@/lib/dates";
import { levelFromXp } from "@/lib/xp";

export const GUILD_MAX_MEMBERS = 30;
/** Objectif hebdo : XP collectif visé par membre. */
export const OBJECTIVE_XP_PER_MEMBER = 750;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function memberCount(db: Db, guildId: string): Promise<number> {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(guildMembers)
    .where(eq(guildMembers.guildId, guildId));
  return count;
}

/** La guilde de l'utilisateur (1 max au tier gratuit — simplification V1 : 1 partout). */
export async function userGuild(db: Db, userId: string) {
  const [row] = await db
    .select({ guild: guilds, membership: guildMembers })
    .from(guildMembers)
    .innerJoin(guilds, eq(guildMembers.guildId, guilds.id))
    .where(eq(guildMembers.userId, userId));
  return row ?? null;
}

export async function createGuild(
  db: Db,
  userId: string,
  input: { name: string; visibility: "public" | "private" },
): Promise<{ ok: true; slug: string } | { ok: false; error: string }> {
  const existing = await userGuild(db, userId);
  if (existing) return { ok: false, error: "Tu es déjà dans une guilde" };

  const slug = slugify(input.name);
  if (slug.length < 2) return { ok: false, error: "Nom trop court" };
  const [taken] = await db.select().from(guilds).where(eq(guilds.slug, slug));
  if (taken) return { ok: false, error: "Ce nom de guilde est déjà pris" };

  await db.transaction(async (tx) => {
    const [guild] = await tx
      .insert(guilds)
      .values({
        name: input.name.trim(),
        slug,
        visibility: input.visibility,
        createdBy: userId,
      })
      .returning();
    await tx.insert(guildMembers).values({
      guildId: guild.id,
      userId,
      role: "leader",
    });
  });
  return { ok: true, slug };
}

export async function joinGuild(
  db: Db,
  user: { id: string; timezone: string },
  slug: string,
): Promise<{ ok: boolean; error?: string }> {
  const existing = await userGuild(db, user.id);
  if (existing) return { ok: false, error: "Tu es déjà dans une guilde" };

  const [guild] = await db.select().from(guilds).where(eq(guilds.slug, slug));
  if (!guild) return { ok: false, error: "Guilde introuvable" };
  if (guild.visibility !== "public") {
    return { ok: false, error: "Cette guilde est sur invitation" };
  }
  if ((await memberCount(db, guild.id)) >= GUILD_MAX_MEMBERS) {
    return { ok: false, error: "Guilde pleine (30 membres max)" };
  }

  await db
    .insert(guildMembers)
    .values({ guildId: guild.id, userId: user.id })
    .onConflictDoNothing();
  await ensureObjective(db, guild.id, user.timezone);
  return { ok: true };
}

export async function leaveGuild(db: Db, userId: string): Promise<boolean> {
  const membership = await userGuild(db, userId);
  if (!membership) return false;
  await db
    .delete(guildMembers)
    .where(
      and(
        eq(guildMembers.guildId, membership.guild.id),
        eq(guildMembers.userId, userId),
      ),
    );
  return true;
}

/** Kick / mute — réservé au chef et aux officiers (GLD-6). */
export async function moderateMember(
  db: Db,
  actorId: string,
  targetUserId: string,
  action: "kick" | "mute" | "unmute",
): Promise<{ ok: boolean; error?: string }> {
  const actor = await userGuild(db, actorId);
  if (!actor || (actor.membership.role !== "leader" && actor.membership.role !== "officer")) {
    return { ok: false, error: "Réservé au chef et aux officiers" };
  }
  if (targetUserId === actorId) {
    return { ok: false, error: "Impossible sur soi-même" };
  }
  const [target] = await db
    .select()
    .from(guildMembers)
    .where(
      and(
        eq(guildMembers.guildId, actor.guild.id),
        eq(guildMembers.userId, targetUserId),
      ),
    );
  if (!target) return { ok: false, error: "Membre introuvable" };
  if (target.role === "leader") {
    return { ok: false, error: "Le chef ne peut pas être modéré" };
  }

  if (action === "kick") {
    await db
      .delete(guildMembers)
      .where(
        and(
          eq(guildMembers.guildId, actor.guild.id),
          eq(guildMembers.userId, targetUserId),
        ),
      );
  } else {
    await db
      .update(guildMembers)
      .set({ muted: action === "mute" })
      .where(
        and(
          eq(guildMembers.guildId, actor.guild.id),
          eq(guildMembers.userId, targetUserId),
        ),
      );
  }
  return { ok: true };
}

/** Crée (si besoin) l'objectif de la semaine : 750 XP × nombre de membres. */
export async function ensureObjective(
  db: Db,
  guildId: string,
  timezone: string,
): Promise<typeof guildObjectives.$inferSelect> {
  const weekStart = weekStartStr(localDateStr(new Date(), timezone));
  const [existing] = await db
    .select()
    .from(guildObjectives)
    .where(
      and(
        eq(guildObjectives.guildId, guildId),
        eq(guildObjectives.weekStart, weekStart),
      ),
    );
  if (existing) return existing;
  const members = await memberCount(db, guildId);
  const [created] = await db
    .insert(guildObjectives)
    .values({
      guildId,
      weekStart,
      targetXp: OBJECTIVE_XP_PER_MEMBER * Math.max(1, members),
    })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [row] = await db
    .select()
    .from(guildObjectives)
    .where(
      and(
        eq(guildObjectives.guildId, guildId),
        eq(guildObjectives.weekStart, weekStart),
      ),
    );
  return row;
}

/**
 * Hook appelé après attribution d'XP (createLog) : contribution hebdo du
 * membre, XP/niveau de guilde, objectif atteint.
 */
export async function contributeToGuild(
  tx: Db,
  user: { id: string; timezone: string },
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  const membership = await userGuild(tx, user.id);
  if (!membership) return;

  await tx
    .update(guildMembers)
    .set({
      weeklyContribution: sql`${guildMembers.weeklyContribution} + ${amount}`,
    })
    .where(
      and(
        eq(guildMembers.guildId, membership.guild.id),
        eq(guildMembers.userId, user.id),
      ),
    );

  const newXp = membership.guild.xpTotal + amount;
  await tx
    .update(guilds)
    .set({ xpTotal: newXp, level: levelFromXp(newXp).level })
    .where(eq(guilds.id, membership.guild.id));

  const objective = await ensureObjective(
    tx,
    membership.guild.id,
    user.timezone,
  );
  if (!objective.achieved) {
    const [{ total }] = await tx
      .select({
        total: sql<number>`coalesce(sum(weekly_contribution), 0)::int`,
      })
      .from(guildMembers)
      .where(eq(guildMembers.guildId, membership.guild.id));
    if (total >= objective.targetXp) {
      await tx
        .update(guildObjectives)
        .set({ achieved: true })
        .where(eq(guildObjectives.id, objective.id));
    }
  }
}

/** Reset hebdo des contributions (cron du lundi 00:00). */
export async function resetWeeklyContributions(db: Db): Promise<void> {
  await db.update(guildMembers).set({ weeklyContribution: 0 });
}

export async function listPublicGuilds(db: Db) {
  const rows = await db
    .select({
      guild: guilds,
      members: sql<number>`(select count(*)::int from guild_members gm where gm.guild_id = ${guilds.id})`,
      leaderName: sql<string | null>`(select u.username from guild_members gm join users u on u.id = gm.user_id where gm.guild_id = ${guilds.id} and gm.role = 'leader' limit 1)`,
    })
    .from(guilds)
    .where(eq(guilds.visibility, "public"))
    .orderBy(guilds.name)
    .limit(50);
  return rows;
}

export async function guildDetail(db: Db, slug: string, viewerId: string) {
  const [guild] = await db.select().from(guilds).where(eq(guilds.slug, slug));
  if (!guild) return null;

  const members = await db
    .select({
      membership: guildMembers,
      username: users.username,
    })
    .from(guildMembers)
    .innerJoin(users, eq(guildMembers.userId, users.id))
    .where(eq(guildMembers.guildId, guild.id))
    .orderBy(sql`weekly_contribution desc`);

  const isMember = members.some((m) => m.membership.userId === viewerId);
  if (guild.visibility !== "public" && !isMember) return null;

  return { guild, members, isMember };
}
