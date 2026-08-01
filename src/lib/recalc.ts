/**
 * Ticket 8 — Recalcul idempotent d'XP.
 *
 * Quand les base_xp des types d'activité sont rééquilibrés, on rejoue les
 * xp_events de type 'log' : chaque événement a stocké ses multiplicateurs
 * (intensité, qualité, streak, diminishing, ratio secondaire), donc
 * nouveau_montant = round(nouveau_base_xp × produit des multiplicateurs),
 * re-plafonné jour par jour dans l'ordre chronologique. Les événements
 * 'quest' / 'achievement' / 'bonus' sont conservés tels quels.
 */

import { and, asc, eq, notInArray } from "drizzle-orm";
import type { Db } from "@/db";
import {
  activityTypes,
  logs,
  userAttributes,
  xpEvents,
} from "@/db/schema";
import type { AttributeCode } from "@/lib/attributes";
import { localDateStr } from "@/lib/dates";
import { dailyXpCap, levelFromXp } from "@/lib/xp";

export interface ReplayItem {
  /** Identifiant de l'événement (pour réécrire le montant). */
  id: string;
  attributeCode: AttributeCode;
  /** base_xp COURANT du type d'activité (déjà multiplié par le ratio secondaire). */
  baseXp: number;
  multipliers: {
    intensity: number;
    quality: number;
    streak: number;
    diminishing: number;
  };
  /** Jour local (YYYY-MM-DD) de l'événement, pour le plafond journalier. */
  localDay: string;
}

export interface ReplayResult {
  amounts: Map<string, number>;
  totals: Map<AttributeCode, number>;
}

/**
 * Cœur pur du recalcul : rejoue les événements dans l'ordre, en réappliquant
 * le plafond journalier (qui dépend du niveau, lui-même recalculé au fil de
 * l'eau). Déterministe : deux exécutions donnent le même résultat.
 */
export function replayLogEvents(
  items: ReplayItem[],
  /** XP hors-log (quêtes, succès…) par attribut, comptés dans les totaux finaux. */
  fixedXp: Partial<Record<AttributeCode, number>> = {},
): ReplayResult {
  const amounts = new Map<string, number>();
  const totals = new Map<AttributeCode, number>();
  const earnedByDay = new Map<string, number>(); // `${attr}:${day}` → xp

  for (const item of items) {
    const m = item.multipliers;
    const raw = Math.round(
      Math.max(0, item.baseXp) *
        (m.intensity ?? 1) *
        (m.quality ?? 1) *
        (m.streak ?? 1) *
        (m.diminishing ?? 1),
    );
    const total = totals.get(item.attributeCode) ?? 0;
    const level = levelFromXp(total).level;
    const cap = dailyXpCap(level);
    const dayKey = `${item.attributeCode}:${item.localDay}`;
    const earned = earnedByDay.get(dayKey) ?? 0;
    const awarded = Math.min(raw, Math.max(0, cap - earned));

    amounts.set(item.id, awarded);
    totals.set(item.attributeCode, total + awarded);
    earnedByDay.set(dayKey, earned + awarded);
  }

  for (const [code, xp] of Object.entries(fixedXp)) {
    totals.set(
      code as AttributeCode,
      (totals.get(code as AttributeCode) ?? 0) + (xp ?? 0),
    );
  }
  return { amounts, totals };
}

/** Rejoue tous les xp_events 'log' d'un utilisateur et resynchronise user_attributes. */
export async function recalcUserXp(db: Db, userId: string, timezone: string) {
  const events = await db
    .select({
      event: xpEvents,
      log: logs,
      type: activityTypes,
    })
    .from(xpEvents)
    .innerJoin(logs, eq(xpEvents.logId, logs.id))
    .innerJoin(activityTypes, eq(logs.activityTypeId, activityTypes.id))
    .where(and(eq(xpEvents.userId, userId), eq(xpEvents.reason, "log")))
    .orderBy(asc(xpEvents.createdAt));

  const otherEvents = await db
    .select()
    .from(xpEvents)
    .where(eq(xpEvents.userId, userId));

  const fixedXp: Partial<Record<AttributeCode, number>> = {};
  for (const e of otherEvents) {
    if (e.reason === "log") continue;
    const code = e.attributeCode as AttributeCode;
    fixedXp[code] = (fixedXp[code] ?? 0) + e.amount;
  }

  const items: ReplayItem[] = events.map(({ event, log, type }) => {
    const m = (event.multipliers ?? {}) as Record<string, number>;
    return {
      id: event.id,
      attributeCode: event.attributeCode as AttributeCode,
      baseXp: type.baseXp * (m.ratio ?? 1),
      multipliers: {
        intensity: m.intensity ?? 1,
        quality: m.quality ?? 1,
        streak: m.streak ?? 1,
        diminishing: m.diminishing ?? 1,
      },
      localDay: localDateStr(log.occurredAt, timezone),
    };
  });

  const { amounts, totals } = replayLogEvents(items, fixedXp);

  return db.transaction(async (tx) => {
    for (const [id, amount] of amounts) {
      await tx.update(xpEvents).set({ amount }).where(eq(xpEvents.id, id));
    }
    const codes = [...totals.keys()];
    for (const code of codes) {
      const xpTotal = totals.get(code) ?? 0;
      await tx
        .insert(userAttributes)
        .values({
          userId,
          attributeCode: code,
          xpTotal,
          level: levelFromXp(xpTotal).level,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userAttributes.userId, userAttributes.attributeCode],
          set: {
            xpTotal,
            level: levelFromXp(xpTotal).level,
            updatedAt: new Date(),
          },
        });
    }
    if (codes.length > 0) {
      // Remet à zéro les attributs qui n'ont plus aucun événement.
      await tx
        .update(userAttributes)
        .set({ xpTotal: 0, level: 1, updatedAt: new Date() })
        .where(
          and(
            eq(userAttributes.userId, userId),
            notInArray(userAttributes.attributeCode, codes),
          ),
        );
    }
    return { updated: amounts.size, totals: Object.fromEntries(totals) };
  });
}
