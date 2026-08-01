import { describe, expect, it } from "vitest";
import {
  computeXp,
  cumulativeXpForLevel,
  dailyXpCap,
  diminishing,
  globalLevel,
  levelFromXp,
  streakMultiplier,
  xpRequiredForLevel,
} from "./xp";

describe("diminishing", () => {
  it("ne pénalise pas le premier log du jour", () => {
    expect(diminishing(1)).toBe(1);
  });

  it("suit la formule 1 / (1 + 0.35 × (n - 1))", () => {
    expect(diminishing(2)).toBeCloseTo(1 / 1.35, 10);
    expect(diminishing(3)).toBeCloseTo(1 / 1.7, 10);
    expect(diminishing(5)).toBeCloseTo(1 / 2.4, 10);
  });

  it("traite les entrées invalides comme n = 1", () => {
    expect(diminishing(0)).toBe(1);
    expect(diminishing(-3)).toBe(1);
    expect(diminishing(NaN)).toBe(1);
  });
});

describe("streakMultiplier", () => {
  it("vaut 1 sans streak", () => {
    expect(streakMultiplier(1)).toBe(1);
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(NaN)).toBe(1);
  });

  it("ajoute 5 % par jour au-delà du premier", () => {
    expect(streakMultiplier(2)).toBeCloseTo(1.05, 10);
    expect(streakMultiplier(6)).toBeCloseTo(1.25, 10);
  });

  it("plafonne à 1.5 à partir de 11 jours", () => {
    expect(streakMultiplier(11)).toBe(1.5);
    expect(streakMultiplier(365)).toBe(1.5);
  });
});

describe("dailyXpCap", () => {
  it("vaut 120 + 15 × niveau", () => {
    expect(dailyXpCap(1)).toBe(135);
    expect(dailyXpCap(10)).toBe(270);
  });

  it("ne descend pas sous 120", () => {
    expect(dailyXpCap(0)).toBe(120);
    expect(dailyXpCap(-4)).toBe(120);
  });
});

describe("computeXp", () => {
  const base = {
    baseXp: 40,
    attributeLevel: 1,
    xpEarnedTodayForAttribute: 0,
  };

  it("retourne l'XP de base avec des multiplicateurs neutres", () => {
    const r = computeXp(base);
    expect(r.awarded).toBe(40);
    expect(r.raw).toBe(40);
    expect(r.capped).toBe(false);
    expect(r.multipliers).toEqual({
      intensity: 1,
      quality: 1,
      streak: 1,
      diminishing: 1,
    });
  });

  it("applique intensité, qualité, streak et diminishing ensemble", () => {
    const r = computeXp({
      ...base,
      intensity: 1.5,
      quality: 1.2,
      streakDays: 6,
      logsOfTypeLast24h: 2,
    });
    // 40 × 1.5 × 1.2 × 1.25 / 1.35 = 66.67 → 67
    expect(r.raw).toBe(67);
    expect(r.awarded).toBe(67);
  });

  it("clampe l'intensité sur [0.5, 2.0]", () => {
    expect(computeXp({ ...base, intensity: 5 }).raw).toBe(80);
    expect(computeXp({ ...base, intensity: 0.1 }).raw).toBe(20);
  });

  it("clampe la qualité sur [0.8, 1.3]", () => {
    expect(computeXp({ ...base, quality: 3 }).raw).toBe(52);
    expect(computeXp({ ...base, quality: 0 }).raw).toBe(32);
  });

  it("tronque au plafond journalier de l'attribut", () => {
    const r = computeXp({
      baseXp: 100,
      intensity: 2,
      attributeLevel: 1, // plafond 135
      xpEarnedTodayForAttribute: 100,
    });
    expect(r.raw).toBe(200);
    expect(r.awarded).toBe(35);
    expect(r.capped).toBe(true);
    expect(r.dailyCap).toBe(135);
  });

  it("n'accorde rien une fois le plafond atteint", () => {
    const r = computeXp({
      baseXp: 50,
      attributeLevel: 0,
      xpEarnedTodayForAttribute: 500,
    });
    expect(r.awarded).toBe(0);
    expect(r.capped).toBe(true);
  });

  it("ignore un baseXp négatif", () => {
    const r = computeXp({ ...base, baseXp: -10 });
    expect(r.awarded).toBe(0);
    expect(r.capped).toBe(false);
  });

  it("est déterministe (rejouable pour le recalcul idempotent)", () => {
    const input = {
      baseXp: 35,
      intensity: 1.7,
      quality: 0.9,
      streakDays: 4,
      logsOfTypeLast24h: 3,
      attributeLevel: 7,
      xpEarnedTodayForAttribute: 60,
    };
    expect(computeXp(input)).toEqual(computeXp(input));
  });
});

describe("xpRequiredForLevel", () => {
  it("correspond aux exemples du PRD", () => {
    expect(xpRequiredForLevel(1)).toBe(100); // niveau 1 → 2
    expect(xpRequiredForLevel(9)).toBe(2700); // niveau 9 → 10
    expect(xpRequiredForLevel(25)).toBe(12500);
  });

  it("retourne 0 sous le niveau 1", () => {
    expect(xpRequiredForLevel(0)).toBe(0);
  });
});

describe("cumulativeXpForLevel", () => {
  it("cumule les paliers précédents", () => {
    expect(cumulativeXpForLevel(1)).toBe(0);
    expect(cumulativeXpForLevel(2)).toBe(100);
    expect(cumulativeXpForLevel(3)).toBe(100 + 283);
  });
});

describe("levelFromXp", () => {
  it("démarre au niveau 1 avec 0 XP", () => {
    const p = levelFromXp(0);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.xpForNextLevel).toBe(100);
    expect(p.progress).toBe(0);
  });

  it("passe au niveau 2 pile à 100 XP", () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
  });

  it("calcule la progression dans le niveau courant", () => {
    const p = levelFromXp(150);
    expect(p.level).toBe(2);
    expect(p.xpIntoLevel).toBe(50);
    expect(p.xpForNextLevel).toBe(283);
    expect(p.progress).toBeCloseTo(50 / 283, 10);
  });

  it("est cohérent avec cumulativeXpForLevel", () => {
    for (const level of [2, 5, 10, 25, 50]) {
      const p = levelFromXp(cumulativeXpForLevel(level));
      expect(p.level).toBe(level);
      expect(p.xpIntoLevel).toBe(0);
    }
  });

  it("gère un XP négatif", () => {
    expect(levelFromXp(-50).level).toBe(1);
  });
});

describe("globalLevel", () => {
  it("fait la moyenne pondérée puis floor", () => {
    const levels = { STR: 10, INT: 2 };
    const weights = { STR: 75, INT: 25 };
    // (10×75 + 2×25) / 100 = 8
    expect(globalLevel(levels, weights)).toBe(8);
  });

  it("retombe sur la moyenne simple sans pondération", () => {
    expect(globalLevel({ STR: 4, INT: 7 }, {})).toBe(5);
  });

  it("retourne 1 sans aucun attribut", () => {
    expect(globalLevel({}, {})).toBe(1);
  });
});
