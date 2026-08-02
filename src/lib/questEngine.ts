/**
 * Ticket 13 — Moteur de génération de quêtes à base de règles :
 * cible l'attribut le plus faible, la variété (attributs délaissés) et la
 * faisabilité (types déjà pratiqués). En mode sur-optimisation, le volume
 * baisse et une quête de récupération (repos/social/zen) est imposée.
 */

import { and, desc, eq, gte, inArray, or } from "drizzle-orm";
import type { Db } from "@/db";
import {
  activityTypes,
  logs,
  questInstances,
  quests,
  userAttributes,
} from "@/db/schema";
import { ATTRIBUTE_CODES, ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { localDateStr, shiftDateStr, weekStartStr } from "@/lib/dates";
import { detectOverdrive } from "@/lib/overdrive";

export interface QuestSpec {
  templateKey: string;
  title: string;
  description: string;
  target: {
    attributeCode?: AttributeCode;
    activityTypeCode?: string;
    count: number;
  };
  xpReward: number;
}

export interface DailyContext {
  /** XP total par attribut (détermine le plus faible). */
  xpByAttribute: Partial<Record<AttributeCode, number>>;
  /** Attributs ayant reçu au moins un log sur les 7 derniers jours. */
  activeAttributesLast7d: Set<AttributeCode>;
  /** Types pratiqués récemment : { code, label, attributeCode }. */
  frequentTypes: { code: string; label: string; attributeCode: AttributeCode }[];
  /** Détecteur XP↑/LQI↓ — réduit le volume et impose la récupération. */
  overdrive: boolean;
}

const RECOVERY_ATTRIBUTES: AttributeCode[] = ["ZEN", "SOC", "VIT"];

function weakestAttribute(
  xpByAttribute: Partial<Record<AttributeCode, number>>,
): AttributeCode {
  let weakest: AttributeCode = ATTRIBUTE_CODES[0];
  let min = Infinity;
  for (const code of ATTRIBUTE_CODES) {
    const xp = xpByAttribute[code] ?? 0;
    if (xp < min) {
      min = xp;
      weakest = code;
    }
  }
  return weakest;
}

/** Cœur pur de la génération journalière — 3 quêtes (2 en mode récupération). */
export function pickDailyQuests(ctx: DailyContext): QuestSpec[] {
  const specs: QuestSpec[] = [];
  const weakest = weakestAttribute(ctx.xpByAttribute);

  if (ctx.overdrive) {
    // Priorité absolue : récupérer. Volume réduit à 2 quêtes.
    const recovery =
      RECOVERY_ATTRIBUTES.find((c) => c !== weakest) ?? "ZEN";
    specs.push({
      templateKey: "daily_recovery",
      title: `Récupération : ${ATTRIBUTES[recovery].name.toLowerCase()}`,
      description:
        "Ton XP grimpe mais ton LQI baisse. Une action douce aujourd'hui — repos, lien social ou calme.",
      target: { attributeCode: recovery, count: 1 },
      xpReward: 30,
    });
    specs.push({
      templateKey: "daily_weakest",
      title: `Un pas en ${ATTRIBUTES[weakest].name}`,
      description: `Une action ${ATTRIBUTES[weakest].name.toLowerCase()} aujourd'hui, même petite.`,
      target: { attributeCode: weakest, count: 1 },
      xpReward: 20,
    });
    return specs;
  }

  // 1. L'attribut le plus faible (équilibre).
  specs.push({
    templateKey: "daily_weakest",
    title: `Un pas en ${ATTRIBUTES[weakest].name}`,
    description: `C'est ton domaine le moins nourri. Une action aujourd'hui, même petite.`,
    target: { attributeCode: weakest, count: 1 },
    xpReward: 20,
  });

  // 2. Faisabilité : continuer un type déjà pratiqué.
  const familiar = ctx.frequentTypes.find(
    (t) => t.attributeCode !== weakest,
  );
  if (familiar) {
    specs.push({
      templateKey: "daily_familiar",
      title: `Continue ta lancée : ${familiar.label}`,
      description: "Tu l'as déjà fait récemment — remets-en une couche.",
      target: { activityTypeCode: familiar.code, count: 1 },
      xpReward: 15,
    });
  }

  // 3. Variété : réveiller un attribut délaissé depuis 7 jours.
  const dormant = ATTRIBUTE_CODES.find(
    (c) =>
      !ctx.activeAttributesLast7d.has(c) &&
      c !== weakest &&
      c !== familiar?.attributeCode,
  );
  if (dormant) {
    const neverTouched = (ctx.xpByAttribute[dormant] ?? 0) === 0;
    specs.push({
      templateKey: "daily_variety",
      title: neverTouched
        ? `Découvre ${ATTRIBUTES[dormant].name}`
        : `Réveille ${ATTRIBUTES[dormant].name}`,
      description: neverTouched
        ? `Domaine encore vierge — une première action ${ATTRIBUTES[dormant].name.toLowerCase()} suffit pour l'ouvrir.`
        : `Aucun log ${ATTRIBUTES[dormant].name.toLowerCase()} depuis une semaine.`,
      target: { attributeCode: dormant, count: 1 },
      xpReward: 25,
    });
  }

  // Complète à 3 si besoin avec une quête de volume générique.
  while (specs.length < 3) {
    specs.push({
      templateKey: "daily_any",
      title: "3 actions aujourd'hui",
      description: "Peu importe le domaine : trois logs dans la journée.",
      target: { count: 3 },
      xpReward: 15,
    });
  }
  return specs.slice(0, 3);
}

/** Hebdo (2 max) : équilibre sur l'attribut le plus faible + régularité. */
export function pickWeeklyQuests(ctx: DailyContext): QuestSpec[] {
  const weakest = weakestAttribute(ctx.xpByAttribute);
  const second = weakestAttribute({
    ...ctx.xpByAttribute,
    [weakest]: Infinity,
  });
  return [
    {
      templateKey: "weekly_weakest",
      title: `Semaine ${ATTRIBUTES[weakest].name} : 4 actions`,
      description: `Quatre logs ${ATTRIBUTES[weakest].name.toLowerCase()} d'ici dimanche pour rééquilibrer ta fiche.`,
      target: { attributeCode: weakest, count: 4 },
      xpReward: 60,
    },
    {
      templateKey: "weekly_second",
      title: `Consolide ${ATTRIBUTES[second].name}`,
      description: `Trois logs ${ATTRIBUTES[second].name.toLowerCase()} cette semaine.`,
      target: { attributeCode: second, count: 3 },
      xpReward: 45,
    },
  ];
}

// ---------------------------------------------------------------------------
// Couche persistance
// ---------------------------------------------------------------------------

async function buildContext(
  db: Db,
  user: { id: string; timezone: string },
): Promise<DailyContext> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const [attrs, recentLogs, overdrive] = await Promise.all([
    db.select().from(userAttributes).where(eq(userAttributes.userId, user.id)),
    db
      .select({
        typeCode: activityTypes.code,
        typeLabel: activityTypes.label,
        attributeCode: activityTypes.attributeCode,
      })
      .from(logs)
      .innerJoin(activityTypes, eq(logs.activityTypeId, activityTypes.id))
      .where(and(eq(logs.userId, user.id), gte(logs.occurredAt, sevenDaysAgo)))
      .orderBy(desc(logs.occurredAt))
      .limit(50),
    detectOverdrive(db, user.id, user.timezone),
  ]);

  const frequencyByCode = new Map<
    string,
    { code: string; label: string; attributeCode: AttributeCode; count: number }
  >();
  const activeAttributes = new Set<AttributeCode>();
  for (const l of recentLogs) {
    activeAttributes.add(l.attributeCode as AttributeCode);
    const entry = frequencyByCode.get(l.typeCode);
    if (entry) entry.count += 1;
    else
      frequencyByCode.set(l.typeCode, {
        code: l.typeCode,
        label: l.typeLabel,
        attributeCode: l.attributeCode as AttributeCode,
        count: 1,
      });
  }

  return {
    xpByAttribute: Object.fromEntries(
      attrs.map((a) => [a.attributeCode, a.xpTotal]),
    ),
    activeAttributesLast7d: activeAttributes,
    frequentTypes: [...frequencyByCode.values()].sort(
      (a, b) => b.count - a.count,
    ),
    overdrive: overdrive.flagged,
  };
}

async function instantiate(
  db: Db,
  userId: string,
  scope: "daily" | "weekly",
  specs: QuestSpec[],
  dueAt: Date,
) {
  for (const spec of specs) {
    const [quest] = await db
      .insert(quests)
      .values({
        scope,
        templateKey: spec.templateKey,
        title: spec.title,
        description: spec.description,
        target: spec.target,
        xpReward: spec.xpReward,
      })
      .returning();
    await db.insert(questInstances).values({
      userId,
      questId: quest.id,
      status: "active",
      progress: { current: 0, target: spec.target.count },
      dueAt,
    });
  }
}

/** Expire les journalières d'un autre jour local et les hebdos d'une autre semaine. */
export async function expireStaleQuests(
  db: Db,
  user: { id: string; timezone: string },
): Promise<void> {
  const now = new Date();
  const today = localDateStr(now, user.timezone);
  const week = weekStartStr(today);

  const active = await db
    .select({ instance: questInstances, quest: quests })
    .from(questInstances)
    .innerJoin(quests, eq(questInstances.questId, quests.id))
    .where(
      and(
        eq(questInstances.userId, user.id),
        eq(questInstances.status, "active"),
        or(eq(quests.scope, "daily"), eq(quests.scope, "weekly")),
      ),
    );

  const stale = active.filter(({ instance, quest }) => {
    const assignedDay = localDateStr(instance.assignedAt, user.timezone);
    return quest.scope === "daily"
      ? assignedDay !== today
      : weekStartStr(assignedDay) !== week;
  });

  if (stale.length > 0) {
    await db
      .update(questInstances)
      .set({ status: "expired" })
      .where(
        inArray(
          questInstances.id,
          stale.map((s) => s.instance.id),
        ),
      );
  }
}

/**
 * Génération paresseuse et idempotente : si les quêtes du jour (ou de la
 * semaine) existent déjà, ne rien faire. Appelée par GET /api/quests/active
 * et par le cron journalier.
 */
export async function ensureQuests(
  db: Db,
  user: { id: string; timezone: string },
): Promise<void> {
  await expireStaleQuests(db, user);
  const now = new Date();
  const today = localDateStr(now, user.timezone);
  const week = weekStartStr(today);

  const existing = await db
    .select({ instance: questInstances, quest: quests })
    .from(questInstances)
    .innerJoin(quests, eq(questInstances.questId, quests.id))
    .where(eq(questInstances.userId, user.id));

  const hasDailyToday = existing.some(
    ({ instance, quest }) =>
      quest.scope === "daily" &&
      localDateStr(instance.assignedAt, user.timezone) === today,
  );
  const hasWeeklyThisWeek = existing.some(
    ({ instance, quest }) =>
      quest.scope === "weekly" &&
      weekStartStr(localDateStr(instance.assignedAt, user.timezone)) === week,
  );

  if (hasDailyToday && hasWeeklyThisWeek) return;

  const ctx = await buildContext(db, user);
  if (!hasDailyToday) {
    const dueAt = new Date(`${shiftDateStr(today, 1)}T00:00:00Z`);
    await instantiate(db, user.id, "daily", pickDailyQuests(ctx), dueAt);
  }
  if (!hasWeeklyThisWeek) {
    const dueAt = new Date(`${shiftDateStr(week, 7)}T00:00:00Z`);
    await instantiate(db, user.id, "weekly", pickWeeklyQuests(ctx), dueAt);
  }
}

/** Reroll gratuit : 1 par jour local — remplace une journalière active. */
export async function rerollQuest(
  db: Db,
  user: { id: string; timezone: string },
  instanceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const today = localDateStr(new Date(), user.timezone);

  const [row] = await db
    .select({ instance: questInstances, quest: quests })
    .from(questInstances)
    .innerJoin(quests, eq(questInstances.questId, quests.id))
    .where(
      and(
        eq(questInstances.id, instanceId),
        eq(questInstances.userId, user.id),
        eq(questInstances.status, "active"),
      ),
    );
  if (!row) return { ok: false, error: "Quête introuvable" };
  if (row.quest.scope !== "daily")
    return { ok: false, error: "Seules les journalières se rerollent" };

  const abandoned = await db
    .select({ instance: questInstances })
    .from(questInstances)
    .where(
      and(
        eq(questInstances.userId, user.id),
        eq(questInstances.status, "abandoned"),
      ),
    );
  const usedToday = abandoned.filter(
    (a) => localDateStr(a.instance.assignedAt, user.timezone) === today,
  ).length;
  if (usedToday >= 1)
    return { ok: false, error: "Reroll gratuit déjà utilisé aujourd'hui" };

  await db
    .update(questInstances)
    .set({ status: "abandoned" })
    .where(eq(questInstances.id, instanceId));

  const ctx = await buildContext(db, user);
  const pool = pickDailyQuests(ctx).filter(
    (s) => s.templateKey !== row.quest.templateKey,
  );
  const spec = pool[0] ?? pickDailyQuests(ctx)[0];
  const dueAt = new Date(`${shiftDateStr(today, 1)}T00:00:00Z`);
  await instantiate(db, user.id, "daily", [spec], dueAt);
  return { ok: true };
}
