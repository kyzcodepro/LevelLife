import { describe, expect, it } from "vitest";
import {
  pickDailyQuests,
  pickWeeklyQuests,
  type DailyContext,
} from "./questEngine";

function ctx(partial: Partial<DailyContext> = {}): DailyContext {
  return {
    xpByAttribute: {
      STR: 500,
      VIT: 400,
      INT: 800,
      DIS: 600,
      SOC: 100,
      CRE: 900,
      FIN: 300,
      ZEN: 200,
    },
    activeAttributesLast7d: new Set(["STR", "INT", "CRE"]),
    frequentTypes: [
      { code: "cre_code", label: "Code / side-project", attributeCode: "CRE" },
      { code: "str_muscu", label: "Musculation", attributeCode: "STR" },
    ],
    overdrive: false,
    ...partial,
  };
}

describe("pickDailyQuests", () => {
  it("génère 3 quêtes journalières", () => {
    const specs = pickDailyQuests(ctx());
    expect(specs).toHaveLength(3);
  });

  it("cible l'attribut le plus faible en premier", () => {
    const specs = pickDailyQuests(ctx());
    expect(specs[0].templateKey).toBe("daily_weakest");
    expect(specs[0].target.attributeCode).toBe("SOC"); // 100 XP = plus faible
  });

  it("propose un type familier pour la faisabilité", () => {
    const specs = pickDailyQuests(ctx());
    const familiar = specs.find((s) => s.templateKey === "daily_familiar");
    expect(familiar?.target.activityTypeCode).toBe("cre_code");
  });

  it("réveille un attribut délaissé depuis 7 jours", () => {
    const specs = pickDailyQuests(ctx());
    const variety = specs.find((s) => s.templateKey === "daily_variety");
    expect(variety).toBeDefined();
    // VIT, DIS, FIN ou ZEN — inactifs, ni le plus faible ni l'attribut familier
    expect(["VIT", "DIS", "FIN", "ZEN"]).toContain(
      variety?.target.attributeCode,
    );
  });

  it("réduit le volume à 2 et impose la récupération en sur-optimisation", () => {
    const specs = pickDailyQuests(ctx({ overdrive: true }));
    expect(specs).toHaveLength(2);
    expect(specs[0].templateKey).toBe("daily_recovery");
    expect(["ZEN", "SOC", "VIT"]).toContain(specs[0].target.attributeCode);
  });

  it("la récupération ne double pas l'attribut le plus faible", () => {
    // SOC est le plus faible → la récup doit viser ZEN ou VIT.
    const specs = pickDailyQuests(ctx({ overdrive: true }));
    expect(specs[0].target.attributeCode).not.toBe("SOC");
  });

  it("complète avec une quête générique quand le contexte est vide", () => {
    const specs = pickDailyQuests(
      ctx({
        frequentTypes: [],
        activeAttributesLast7d: new Set([
          "STR", "VIT", "INT", "DIS", "SOC", "CRE", "FIN", "ZEN",
        ]),
      }),
    );
    expect(specs).toHaveLength(3);
    expect(specs.some((s) => s.templateKey === "daily_any")).toBe(true);
  });
});

describe("pickWeeklyQuests", () => {
  it("génère 2 hebdos ciblant les deux attributs les plus faibles", () => {
    const specs = pickWeeklyQuests(ctx());
    expect(specs).toHaveLength(2);
    expect(specs[0].target.attributeCode).toBe("SOC"); // 100
    expect(specs[1].target.attributeCode).toBe("ZEN"); // 200
    expect(specs[0].target.count).toBeGreaterThan(1);
  });
});
