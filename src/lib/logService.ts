/**
 * Service central du Codex : création/annulation de logs avec attribution d'XP
 * transactionnelle (ticket 7) — log → xp_events → user_attributes → level-up,
 * mise à jour des streaks et progression des quêtes actives au passage.
 */

import { and, desc, eq, gte, inArray, isNull, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  activityTypes,
  habits,
  logs,
  questInstances,
  quests,
  streaks,
  userAttributes,
  xpEvents,
} from "@/db/schema";
import { ATTRIBUTE_CODES, type AttributeCode } from "@/lib/attributes";
import { localDateStr, shiftDateStr } from "@/lib/dates";
import { computeXp, levelFromXp } from "@/lib/xp";

/** Part de l'XP attribuée à l'attribut secondaire d'un type d'activité. */
export const SECONDARY_ATTRIBUTE_RATIO = 0.3;

// Le type de transaction Drizzle est structurellement identique à Db pour
// notre usage ; on garde Db pour rester lisible.
type Tx = Db;

export interface CreateLogInput {
  activityTypeId: string;
  occurredAt?: Date;
  durationMin?: number | null;
  intensity?: number | null;
  quality?: number | null;
  mood?: number | null;
  note?: string | null;
  tags?: string[] | null;
  mediaUrls?: string[] | null;
  source?: "manual" | "voice" | "integration" | "import";
}

export interface XpAward {
  attributeCode: AttributeCode;
  amount: number;
  levelBefore: number;
  levelAfter: number;
}

export interface CreateLogResult {
  log: typeof logs.$inferSelect;
  awards: XpAward[];
  levelUps: { attributeCode: AttributeCode; newLevel: number }[];
  completedQuests: { id: string; title: string; xpReward: number }[];
  streak: { current: number; lifetimeTotal: number } | null;
}

export async function ensureUserAttributes(db: Db, userId: string) {
  await db
    .insert(userAttributes)
    .values(
      ATTRIBUTE_CODES.map((code) => ({ userId, attributeCode: code })),
    )
    .onConflictDoNothing();
}

/** Insère un xp_event et met à jour user_attributes. Retourne niveaux avant/après. */
export async function applyXpEvent(
  tx: Tx,
  params: {
    userId: string;
    attributeCode: AttributeCode;
    amount: number;
    multipliers?: Record<string, number>;
    reason: "log" | "quest" | "achievement" | "bonus";
    logId?: string | null;
  },
): Promise<XpAward> {
  const [current] = await tx
    .select()
    .from(userAttributes)
    .where(
      and(
        eq(userAttributes.userId, params.userId),
        eq(userAttributes.attributeCode, params.attributeCode),
      ),
    );
  const xpBefore = current?.xpTotal ?? 0;
  const levelBefore = current?.level ?? 1;
  const xpAfter = xpBefore + params.amount;
  const levelAfter = levelFromXp(xpAfter).level;

  await tx.insert(xpEvents).values({
    userId: params.userId,
    logId: params.logId ?? null,
    attributeCode: params.attributeCode,
    amount: params.amount,
    multipliers: params.multipliers,
    reason: params.reason,
  });

  await tx
    .insert(userAttributes)
    .values({
      userId: params.userId,
      attributeCode: params.attributeCode,
      xpTotal: xpAfter,
      level: levelAfter,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [userAttributes.userId, userAttributes.attributeCode],
      set: { xpTotal: xpAfter, level: levelAfter, updatedAt: new Date() },
    });

  return {
    attributeCode: params.attributeCode,
    amount: params.amount,
    levelBefore,
    levelAfter,
  };
}

/** XP déjà gagné aujourd'hui (jour local utilisateur) sur un attribut. */
async function xpEarnedToday(
  tx: Tx,
  userId: string,
  attributeCode: string,
  timezone: string,
  now: Date,
): Promise<number> {
  const since = new Date(now.getTime() - 36 * 3600 * 1000);
  const events = await tx
    .select({ amount: xpEvents.amount, createdAt: xpEvents.createdAt })
    .from(xpEvents)
    .where(
      and(
        eq(xpEvents.userId, userId),
        eq(xpEvents.attributeCode, attributeCode),
        gte(xpEvents.createdAt, since),
      ),
    );
  const today = localDateStr(now, timezone);
  return events
    .filter((e) => localDateStr(e.createdAt, timezone) === today)
    .reduce((sum, e) => sum + e.amount, 0);
}

/**
 * Met à jour le streak de l'habitude liée à ce type d'activité, s'il y en a une.
 * Un gel (Mode Repos) couvre automatiquement un jour manqué isolé.
 * Retourne le streak courant (= streak_days pour le multiplicateur d'XP).
 */
async function touchStreak(
  tx: Tx,
  userId: string,
  activityTypeId: string,
  timezone: string,
  now: Date,
): Promise<{ current: number; lifetimeTotal: number } | null> {
  const [habit] = await tx
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.userId, userId),
        eq(habits.activityTypeId, activityTypeId),
        eq(habits.active, true),
      ),
    );
  if (!habit) return null;

  const [streak] = await tx
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, userId), eq(streaks.habitId, habit.id)));

  const today = localDateStr(now, timezone);
  const yesterday = shiftDateStr(today, -1);
  const dayBefore = shiftDateStr(today, -2);

  if (!streak) {
    const [created] = await tx
      .insert(streaks)
      .values({
        userId,
        habitId: habit.id,
        current: 1,
        best: 1,
        lifetimeTotal: 1,
        lastDoneOn: today,
      })
      .returning();
    return { current: created.current, lifetimeTotal: created.lifetimeTotal };
  }

  if (streak.lastDoneOn === today) {
    return { current: streak.current, lifetimeTotal: streak.lifetimeTotal };
  }

  let current: number;
  let freezesLeft = streak.freezesLeft;
  if (streak.lastDoneOn === yesterday) {
    current = streak.current + 1;
  } else if (streak.lastDoneOn === dayBefore && freezesLeft > 0) {
    // Mode Repos : le gel couvre le jour manqué, le streak continue.
    freezesLeft -= 1;
    current = streak.current + 1;
  } else {
    current = 1;
  }

  const [updated] = await tx
    .update(streaks)
    .set({
      current,
      best: Math.max(streak.best, current),
      lifetimeTotal: streak.lifetimeTotal + 1,
      lastDoneOn: today,
      freezesLeft,
    })
    .where(eq(streaks.id, streak.id))
    .returning();
  return { current: updated.current, lifetimeTotal: updated.lifetimeTotal };
}

/**
 * Progression des quêtes actives : une quête cible soit un type d'activité
 * (target.activityTypeCode), soit un attribut (target.attributeCode), avec
 * un compteur target.count. Complétion automatique + XP de récompense.
 */
async function progressQuests(
  tx: Tx,
  userId: string,
  activityTypeCode: string,
  attributeCodes: AttributeCode[],
  now: Date,
): Promise<{ id: string; title: string; xpReward: number }[]> {
  const active = await tx
    .select({
      instance: questInstances,
      quest: quests,
    })
    .from(questInstances)
    .innerJoin(quests, eq(questInstances.questId, quests.id))
    .where(
      and(
        eq(questInstances.userId, userId),
        eq(questInstances.status, "active"),
      ),
    );

  const completed: { id: string; title: string; xpReward: number }[] = [];

  for (const { instance, quest } of active) {
    const target = (quest.target ?? {}) as {
      activityTypeCode?: string;
      attributeCode?: string;
      count?: number;
      manual?: boolean;
    };
    if (target.manual) continue;
    const matches = target.activityTypeCode
      ? target.activityTypeCode === activityTypeCode
      : target.attributeCode
        ? attributeCodes.includes(target.attributeCode as AttributeCode)
        : false;
    if (!matches) continue;

    const progress = (instance.progress ?? {}) as { current?: number };
    const current = (progress.current ?? 0) + 1;
    const goal = target.count ?? 1;

    if (current >= goal) {
      await tx
        .update(questInstances)
        .set({
          status: "completed",
          progress: { current, target: goal },
          completedAt: now,
        })
        .where(eq(questInstances.id, instance.id));
      if (quest.xpReward > 0) {
        const attr = (target.attributeCode ??
          attributeCodes[0] ??
          "DIS") as AttributeCode;
        await applyXpEvent(tx, {
          userId,
          attributeCode: attr,
          amount: quest.xpReward,
          reason: "quest",
        });
      }
      completed.push({
        id: instance.id,
        title: quest.title,
        xpReward: quest.xpReward,
      });
    } else {
      await tx
        .update(questInstances)
        .set({ progress: { current, target: goal } })
        .where(eq(questInstances.id, instance.id));
    }
  }
  return completed;
}

/** Ticket 7 — création de log transactionnelle avec calcul d'XP complet. */
export async function createLog(
  db: Db,
  user: { id: string; timezone: string },
  input: CreateLogInput,
): Promise<CreateLogResult> {
  const [type] = await db
    .select()
    .from(activityTypes)
    .where(
      and(
        eq(activityTypes.id, input.activityTypeId),
        or(isNull(activityTypes.userId), eq(activityTypes.userId, user.id)),
      ),
    );
  if (!type) throw new Error("Type d'activité introuvable");

  await ensureUserAttributes(db, user.id);
  const now = new Date();
  const occurredAt = input.occurredAt ?? now;

  return db.transaction(async (tx) => {
    // Valeurs par défaut : celles du dernier log du même type (critère CDX-1).
    const [lastLog] = await tx
      .select()
      .from(logs)
      .where(
        and(eq(logs.userId, user.id), eq(logs.activityTypeId, type.id)),
      )
      .orderBy(desc(logs.occurredAt))
      .limit(1);

    const intensity =
      input.intensity ?? (lastLog?.intensity ? Number(lastLog.intensity) : 1);
    const quality =
      input.quality ?? (lastLog?.quality ? Number(lastLog.quality) : 1);
    const durationMin = input.durationMin ?? lastLog?.durationMin ?? null;

    const [log] = await tx
      .insert(logs)
      .values({
        userId: user.id,
        activityTypeId: type.id,
        occurredAt,
        durationMin,
        intensity: String(intensity),
        quality: String(quality),
        mood: input.mood ?? null,
        note: input.note ?? null,
        tags: input.tags ?? null,
        mediaUrls: input.mediaUrls ?? null,
        source: input.source ?? "manual",
      })
      .returning();

    // Anti-farm : rang de ce log parmi ceux du même type sur 24 h glissantes.
    const [{ count: n }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(logs)
      .where(
        and(
          eq(logs.userId, user.id),
          eq(logs.activityTypeId, type.id),
          gte(logs.occurredAt, new Date(now.getTime() - 24 * 3600 * 1000)),
        ),
      );

    const streak = await touchStreak(tx, user.id, type.id, user.timezone, now);

    const awards: XpAward[] = [];
    const levelUps: { attributeCode: AttributeCode; newLevel: number }[] = [];

    const targets: { code: AttributeCode; ratio: number }[] = [
      { code: type.attributeCode as AttributeCode, ratio: 1 },
    ];
    if (type.secondaryAttributeCode) {
      targets.push({
        code: type.secondaryAttributeCode as AttributeCode,
        ratio: SECONDARY_ATTRIBUTE_RATIO,
      });
    }

    for (const target of targets) {
      const [attr] = await tx
        .select()
        .from(userAttributes)
        .where(
          and(
            eq(userAttributes.userId, user.id),
            eq(userAttributes.attributeCode, target.code),
          ),
        );
      const earnedToday = await xpEarnedToday(
        tx,
        user.id,
        target.code,
        user.timezone,
        now,
      );
      const result = computeXp({
        baseXp: type.baseXp * target.ratio,
        intensity,
        quality,
        streakDays: streak?.current ?? 1,
        logsOfTypeLast24h: n,
        attributeLevel: attr?.level ?? 1,
        xpEarnedTodayForAttribute: earnedToday,
      });
      if (result.awarded <= 0) continue;
      const award = await applyXpEvent(tx, {
        userId: user.id,
        attributeCode: target.code,
        amount: result.awarded,
        multipliers: { ...result.multipliers, ratio: target.ratio },
        reason: "log",
        logId: log.id,
      });
      awards.push(award);
      if (award.levelAfter > award.levelBefore) {
        levelUps.push({
          attributeCode: target.code,
          newLevel: award.levelAfter,
        });
      }
    }

    const completedQuests = await progressQuests(
      tx,
      user.id,
      type.code,
      targets.map((t) => t.code),
      now,
    );

    return { log, awards, levelUps, completedQuests, streak };
  });
}

/** Annulation : supprime le log et retire l'XP correspondant (undo 10 s). */
export async function deleteLog(
  db: Db,
  userId: string,
  logId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [log] = await tx
      .select()
      .from(logs)
      .where(and(eq(logs.id, logId), eq(logs.userId, userId)));
    if (!log) return false;

    const events = await tx
      .select()
      .from(xpEvents)
      .where(and(eq(xpEvents.logId, logId), eq(xpEvents.reason, "log")));

    for (const event of events) {
      const [attr] = await tx
        .select()
        .from(userAttributes)
        .where(
          and(
            eq(userAttributes.userId, userId),
            eq(userAttributes.attributeCode, event.attributeCode),
          ),
        );
      if (attr) {
        const xpAfter = Math.max(0, attr.xpTotal - event.amount);
        await tx
          .update(userAttributes)
          .set({
            xpTotal: xpAfter,
            level: levelFromXp(xpAfter).level,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(userAttributes.userId, userId),
              eq(userAttributes.attributeCode, event.attributeCode),
            ),
          );
      }
    }

    if (events.length > 0) {
      await tx.delete(xpEvents).where(
        inArray(
          xpEvents.id,
          events.map((e) => e.id),
        ),
      );
    }
    await tx.delete(logs).where(eq(logs.id, logId));
    return true;
  });
}
