import { describe, expect, it } from "vitest";
import { computeLqi, generateInsights, gini, type LqiInput } from "./lqi";
import { detectOverdriveCore } from "./overdrive";

describe("gini", () => {
  it("vaut 0 pour une égalité parfaite", () => {
    expect(gini([10, 10, 10, 10])).toBeCloseTo(0, 10);
  });

  it("tend vers 1 pour une concentration totale", () => {
    expect(gini([0, 0, 0, 100])).toBeCloseTo(0.75, 10); // (n-1)/n avec n=4
    expect(gini([0, 0, 0, 0, 0, 0, 0, 800])).toBeCloseTo(0.875, 10); // n=8
  });

  it("gère les tableaux vides et nuls", () => {
    expect(gini([])).toBe(0);
    expect(gini([0, 0, 0])).toBe(0);
  });
});

function input(partial: Partial<LqiInput> = {}): LqiInput {
  return {
    sliders: {
      energy: 7,
      mood: 7,
      meaning: 7,
      relations: 7,
      stress: 4, // inversé → 7
      satisfaction: 7,
    },
    xpByAttribute: {
      STR: 100, VIT: 100, INT: 100, DIS: 100,
      SOC: 100, CRE: 100, FIN: 100, ZEN: 100,
    },
    questsTaken: 4,
    questsCompleted: 3,
    activeDays: 6,
    ...partial,
  };
}

describe("computeLqi", () => {
  it("calcule le subjectif : moyenne × 10 avec stress inversé", () => {
    const r = computeLqi(input());
    expect(r.subjective).toBe(70);
  });

  it("l'équilibre parfait donne 100", () => {
    const r = computeLqi(input());
    expect(r.balance).toBe(100);
  });

  it("pénalise le all-in sur un seul attribut", () => {
    const r = computeLqi(
      input({ xpByAttribute: { CRE: 800 } }),
    );
    expect(r.balance).toBeCloseTo(12.5, 1); // 100 × (1 − 0.875)
  });

  it("une semaine sans activité ne crédite pas l'équilibre", () => {
    const r = computeLqi(input({ xpByAttribute: {} }));
    expect(r.balance).toBe(0);
  });

  it("momentum = complétion × régularité", () => {
    const r = computeLqi(input());
    // (3/4) × (6/7) × 100 = 64.3
    expect(r.momentum).toBeCloseTo(64.3, 1);
  });

  it("sans quête prise, le momentum suit la régularité seule", () => {
    const r = computeLqi(input({ questsTaken: 0, questsCompleted: 0 }));
    expect(r.momentum).toBeCloseTo((6 / 7) * 100, 1);
  });

  it("pondère 0.45 / 0.35 / 0.20", () => {
    const r = computeLqi(input());
    const expected = 0.45 * 70 + 0.35 * 100 + 0.2 * r.momentum;
    expect(r.total).toBeCloseTo(expected, 1);
  });

  it("reste borné entre 0 et 100", () => {
    const worst = computeLqi(
      input({
        sliders: {
          energy: 1, mood: 1, meaning: 1, relations: 1,
          stress: 10, satisfaction: 1,
        },
        xpByAttribute: {},
        questsTaken: 5,
        questsCompleted: 0,
        activeDays: 0,
      }),
    );
    expect(worst.total).toBeGreaterThanOrEqual(0);
    const best = computeLqi(
      input({
        sliders: {
          energy: 10, mood: 10, meaning: 10, relations: 10,
          stress: 1, satisfaction: 10,
        },
        questsTaken: 3,
        questsCompleted: 3,
        activeDays: 7,
      }),
    );
    expect(best.total).toBeLessThanOrEqual(100);
    expect(best.total).toBe(100);
  });
});

describe("generateInsights", () => {
  it("produit exactement 3 insights", () => {
    const breakdown = computeLqi(input());
    const insights = generateInsights({
      breakdown,
      previousTotal: null,
      xpByAttribute: input().xpByAttribute,
      activeDays: 6,
    });
    expect(insights).toHaveLength(3);
    expect(insights[0]).toContain("ligne de base");
  });

  it("signale la baisse et cible l'attribut délaissé", () => {
    const breakdown = computeLqi(input({ xpByAttribute: { CRE: 800 } }));
    const insights = generateInsights({
      breakdown,
      previousTotal: breakdown.total + 10,
      xpByAttribute: { CRE: 800 },
      activeDays: 6,
    });
    expect(insights[0]).toContain("baisse");
    expect(insights[1]).toContain("Création");
  });
});

describe("detectOverdriveCore", () => {
  const week = (weekStart: string, xp: number, lqi: number) => ({
    weekStart,
    xp,
    lqi,
  });

  it("signale XP↑ + LQI↓ sur 3 semaines", () => {
    expect(
      detectOverdriveCore([
        week("2026-07-06", 500, 70),
        week("2026-07-13", 700, 62),
        week("2026-07-20", 900, 55),
      ]),
    ).toBe(true);
  });

  it("ne signale pas si le LQI suit l'XP", () => {
    expect(
      detectOverdriveCore([
        week("2026-07-06", 500, 60),
        week("2026-07-13", 700, 65),
        week("2026-07-20", 900, 70),
      ]),
    ).toBe(false);
  });

  it("ne signale pas avec moins de 3 semaines", () => {
    expect(
      detectOverdriveCore([
        week("2026-07-13", 700, 62),
        week("2026-07-20", 900, 55),
      ]),
    ).toBe(false);
  });
});
