import { describe, expect, it } from "vitest";
import { replayLogEvents, type ReplayItem } from "./recalc";

const NEUTRAL = { intensity: 1, quality: 1, streak: 1, diminishing: 1 };

function item(partial: Partial<ReplayItem> & { id: string }): ReplayItem {
  return {
    attributeCode: "STR",
    baseXp: 40,
    multipliers: NEUTRAL,
    localDay: "2026-08-01",
    ...partial,
  };
}

describe("replayLogEvents", () => {
  it("recalcule les montants avec le nouveau base_xp", () => {
    const { amounts, totals } = replayLogEvents([
      item({ id: "a", baseXp: 50 }),
      item({ id: "b", baseXp: 50, localDay: "2026-08-02" }),
    ]);
    expect(amounts.get("a")).toBe(50);
    expect(amounts.get("b")).toBe(50);
    expect(totals.get("STR")).toBe(100);
  });

  it("réapplique les multiplicateurs stockés", () => {
    const { amounts } = replayLogEvents([
      item({
        id: "a",
        baseXp: 40,
        multipliers: { intensity: 1.5, quality: 1.2, streak: 1.25, diminishing: 1 / 1.35 },
      }),
    ]);
    // 40 × 1.5 × 1.2 × 1.25 / 1.35 = 66.67 → 67 (identique au calcul d'origine)
    expect(amounts.get("a")).toBe(67);
  });

  it("réapplique le plafond journalier chronologiquement", () => {
    // a : 100 XP → total 100 → niveau 2 → cap passe à 150
    // b : min(100, 150 − 100) = 50 ; c : plafond atteint → 0
    const { amounts } = replayLogEvents([
      item({ id: "a", baseXp: 100 }),
      item({ id: "b", baseXp: 100 }),
      item({ id: "c", baseXp: 100 }),
    ]);
    expect(amounts.get("a")).toBe(100);
    expect(amounts.get("b")).toBe(50);
    expect(amounts.get("c")).toBe(0);
  });

  it("le plafond repart à zéro le jour suivant (et suit le niveau)", () => {
    const { amounts } = replayLogEvents([
      item({ id: "a", baseXp: 200 }), // cap niveau 1 = 135 → total 135 → niveau 2
      item({ id: "b", baseXp: 200, localDay: "2026-08-02" }), // cap niveau 2 = 150
    ]);
    expect(amounts.get("a")).toBe(135);
    expect(amounts.get("b")).toBe(150);
  });

  it("le plafond suit le niveau recalculé au fil du rejeu", () => {
    // 300 XP → niveau 2 (100 + 283 > 300 → niveau 2) → cap 150
    const items: ReplayItem[] = [
      item({ id: "a", baseXp: 135 }), // jour 1, total 135 → niveau 2
      item({ id: "b", baseXp: 200, localDay: "2026-08-02" }),
    ];
    const { amounts } = replayLogEvents(items);
    expect(amounts.get("a")).toBe(135);
    expect(amounts.get("b")).toBe(150); // cap = 120 + 15×2
  });

  it("sépare les plafonds par attribut", () => {
    const { amounts, totals } = replayLogEvents([
      item({ id: "a", baseXp: 200 }),
      item({ id: "b", baseXp: 200, attributeCode: "INT" }),
    ]);
    expect(amounts.get("a")).toBe(135);
    expect(amounts.get("b")).toBe(135);
    expect(totals.get("INT")).toBe(135);
  });

  it("ajoute l'XP hors-log (quêtes, succès) aux totaux finaux", () => {
    const { totals } = replayLogEvents([item({ id: "a", baseXp: 40 })], {
      STR: 60,
      ZEN: 25,
    });
    expect(totals.get("STR")).toBe(100);
    expect(totals.get("ZEN")).toBe(25);
  });

  it("est idempotent : rejouer deux fois donne le même résultat", () => {
    const items = [
      item({ id: "a", baseXp: 90, multipliers: { ...NEUTRAL, intensity: 1.4 } }),
      item({ id: "b", baseXp: 90 }),
      item({ id: "c", baseXp: 90, localDay: "2026-08-02" }),
    ];
    const first = replayLogEvents(items);
    const second = replayLogEvents(items);
    expect([...first.amounts.entries()]).toEqual([...second.amounts.entries()]);
    expect([...first.totals.entries()]).toEqual([...second.totals.entries()]);
  });
});
