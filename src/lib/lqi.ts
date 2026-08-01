/**
 * Tickets 17-19 — Le LQI (Life Quality Index), la métrique qui compte.
 *
 * LQI = 0.45 × Subjectif + 0.35 × Équilibre + 0.20 × Momentum   (0–100)
 *
 * - Subjectif : check-in hebdo, 6 curseurs 1-10 (stress inversé) → moyenne × 10
 * - Équilibre : 100 × (1 − Gini(xp_semaine par attribut)) — pénalise le all-in
 * - Momentum  : 100 × (quêtes_ok / quêtes_prises) × (jours actifs / 7)
 *
 * Le LQI est PRIVÉ : jamais exposé dans un classement (PRD §11.4).
 */

import { and, eq, gte, lte } from "drizzle-orm";
import type { Db } from "@/db";
import {
  checkins,
  lqiScores,
  questInstances,
  xpEvents,
} from "@/db/schema";
import { ATTRIBUTE_CODES, ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { localDateStr, shiftDateStr } from "@/lib/dates";

export interface CheckinSliders {
  energy: number;
  mood: number;
  meaning: number;
  relations: number;
  /** Curseur brut 1-10 : 10 = très stressé (inversé dans le calcul). */
  stress: number;
  satisfaction: number;
}

export interface LqiInput {
  sliders: CheckinSliders;
  /** XP de la semaine par attribut (les 8 codes, 0 si rien). */
  xpByAttribute: Partial<Record<AttributeCode, number>>;
  questsTaken: number;
  questsCompleted: number;
  /** Jours de la semaine avec au moins un log (0-7). */
  activeDays: number;
}

export interface LqiBreakdown {
  subjective: number;
  balance: number;
  momentum: number;
  total: number;
}

/** Indice de Gini sur un tableau de valeurs ≥ 0. 0 = égalité parfaite. */
export function gini(values: number[]): number {
  const n = values.length;
  if (n === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let cumulative = 0;
  for (let i = 0; i < n; i++) {
    cumulative += sorted[i] * (2 * (i + 1) - n - 1);
  }
  return cumulative / (n * sum);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function computeLqi(input: LqiInput): LqiBreakdown {
  const s = input.sliders;
  const values = [
    s.energy,
    s.mood,
    s.meaning,
    s.relations,
    11 - s.stress, // stress inversé
    s.satisfaction,
  ];
  const subjective = (values.reduce((a, b) => a + b, 0) / values.length) * 10;

  const xp = ATTRIBUTE_CODES.map((c) => input.xpByAttribute[c] ?? 0);
  const totalXp = xp.reduce((a, b) => a + b, 0);
  // Semaine sans aucune activité : pas de crédit d'équilibre.
  const balance = totalXp === 0 ? 0 : 100 * (1 - gini(xp));

  const completion =
    input.questsTaken > 0
      ? clamp01(input.questsCompleted / input.questsTaken)
      : 1;
  const regularity = clamp01(input.activeDays / 7);
  const momentum = 100 * completion * regularity;

  const total = 0.45 * subjective + 0.35 * balance + 0.2 * momentum;
  const round1 = (v: number) => Math.round(v * 10) / 10;
  return {
    subjective: round1(subjective),
    balance: round1(balance),
    momentum: round1(momentum),
    total: round1(total),
  };
}

/** 3 insights à base de règles (le LLM viendra en fallback créatif plus tard). */
export function generateInsights(params: {
  breakdown: LqiBreakdown;
  previousTotal: number | null;
  xpByAttribute: Partial<Record<AttributeCode, number>>;
  activeDays: number;
}): string[] {
  const { breakdown, previousTotal, xpByAttribute, activeDays } = params;
  const insights: string[] = [];

  // 1. Tendance générale.
  if (previousTotal === null) {
    insights.push(
      `Premier LQI mesuré : ${breakdown.total}/100. C'est ta ligne de base — l'important est la tendance, pas le chiffre.`,
    );
  } else {
    const delta = Math.round((breakdown.total - previousTotal) * 10) / 10;
    if (delta > 2) {
      insights.push(
        `LQI en hausse de ${delta} pts. Ce que tu fais fonctionne — garde ce rythme, pas plus.`,
      );
    } else if (delta < -2) {
      insights.push(
        `LQI en baisse de ${Math.abs(delta)} pts. Regarde la composante la plus faible ci-dessous : c'est là que ça se joue.`,
      );
    } else {
      insights.push(
        `LQI stable (${delta >= 0 ? "+" : ""}${delta} pt). La constance compte plus que les pics.`,
      );
    }
  }

  // 2. Composante la plus faible.
  const weakestComponent = [
    ["ressenti", breakdown.subjective],
    ["équilibre", breakdown.balance],
    ["momentum", breakdown.momentum],
  ].sort((a, b) => (a[1] as number) - (b[1] as number))[0];
  if (weakestComponent[0] === "équilibre") {
    const sorted = ATTRIBUTE_CODES.map((c) => ({
      code: c,
      xp: xpByAttribute[c] ?? 0,
    })).sort((a, b) => a.xp - b.xp);
    const low = sorted[0];
    const high = sorted[sorted.length - 1];
    insights.push(
      `Ton XP est concentré sur ${ATTRIBUTES[high.code].name} pendant que ${ATTRIBUTES[low.code].name} est à sec. Une seule action ${ATTRIBUTES[low.code].name.toLowerCase()} cette semaine remonterait ton équilibre.`,
    );
  } else if (weakestComponent[0] === "momentum") {
    insights.push(
      activeDays < 4
        ? `${activeDays} jour(s) actif(s) sur 7 : la régularité pèse plus que le volume. Vise un log par jour, même minuscule.`
        : `Tes quêtes prises ne sont pas finies. Prends-en moins, termine-les.`,
    );
  } else {
    insights.push(
      `Ton ressenti est la composante la plus basse : les chiffres montent mais la sensation ne suit pas. Priorité aux quêtes repos/social, pas au volume.`,
    );
  }

  // 3. Point d'appui.
  const best = [
    ["ressenti", breakdown.subjective],
    ["équilibre", breakdown.balance],
    ["momentum", breakdown.momentum],
  ].sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  insights.push(
    `Point fort de la semaine : ${best[0]} (${best[1]}/100). Appuie-toi dessus plutôt que de tout corriger à la fois.`,
  );

  return insights;
}

/**
 * Calcule et stocke le LQI de la semaine contenant `weekStart` (lundi, date
 * locale). Retourne le score et les insights. Idempotent (upsert).
 */
export async function computeWeeklyLqi(
  db: Db,
  user: { id: string; timezone: string },
  weekStart: string,
): Promise<{ breakdown: LqiBreakdown; insights: string[] } | null> {
  const [checkin] = await db
    .select()
    .from(checkins)
    .where(
      and(eq(checkins.userId, user.id), eq(checkins.weekStart, weekStart)),
    );
  if (!checkin) return null;

  const weekEnd = shiftDateStr(weekStart, 7);
  const from = new Date(`${weekStart}T00:00:00Z`);
  const to = new Date(`${weekEnd}T23:59:59Z`);

  const [events, instances, previous] = await Promise.all([
    db
      .select({
        amount: xpEvents.amount,
        attributeCode: xpEvents.attributeCode,
        createdAt: xpEvents.createdAt,
      })
      .from(xpEvents)
      .where(
        and(
          eq(xpEvents.userId, user.id),
          gte(xpEvents.createdAt, from),
          lte(xpEvents.createdAt, to),
        ),
      ),
    db
      .select()
      .from(questInstances)
      .where(eq(questInstances.userId, user.id)),
    db
      .select()
      .from(lqiScores)
      .where(
        and(
          eq(lqiScores.userId, user.id),
          eq(lqiScores.weekStart, shiftDateStr(weekStart, -7)),
        ),
      ),
  ]);

  const xpByAttribute: Partial<Record<AttributeCode, number>> = {};
  const activeDaySet = new Set<string>();
  for (const e of events) {
    const day = localDateStr(e.createdAt, user.timezone);
    if (day >= weekStart && day < weekEnd) {
      const code = e.attributeCode as AttributeCode;
      xpByAttribute[code] = (xpByAttribute[code] ?? 0) + e.amount;
      activeDaySet.add(day);
    }
  }

  const weekInstances = instances.filter((i) => {
    const day = localDateStr(i.assignedAt, user.timezone);
    return day >= weekStart && day < weekEnd;
  });
  const questsTaken = weekInstances.filter(
    (i) => i.status !== "abandoned",
  ).length;
  const questsCompleted = weekInstances.filter(
    (i) => i.status === "completed",
  ).length;

  const breakdown = computeLqi({
    sliders: {
      energy: checkin.energy,
      mood: checkin.mood,
      meaning: checkin.meaning,
      relations: checkin.relations,
      stress: checkin.stress,
      satisfaction: checkin.satisfaction,
    },
    xpByAttribute,
    questsTaken,
    questsCompleted,
    activeDays: activeDaySet.size,
  });

  const previousTotal = previous[0] ? Number(previous[0].total) : null;
  const insights = generateInsights({
    breakdown,
    previousTotal,
    xpByAttribute,
    activeDays: activeDaySet.size,
  });

  await db
    .insert(lqiScores)
    .values({
      userId: user.id,
      weekStart,
      subjective: String(breakdown.subjective),
      balance: String(breakdown.balance),
      momentum: String(breakdown.momentum),
      total: String(breakdown.total),
      insights,
    })
    .onConflictDoUpdate({
      target: [lqiScores.userId, lqiScores.weekStart],
      set: {
        subjective: String(breakdown.subjective),
        balance: String(breakdown.balance),
        momentum: String(breakdown.momentum),
        total: String(breakdown.total),
        insights,
      },
    });

  return { breakdown, insights };
}
