import { describe, expect, it } from "vitest";
import {
  isUnlocked,
  newlyUnlocked,
  nextUnlock,
  unlockedModules,
} from "./unlocks";

describe("unlocks", () => {
  it("tout est verrouillé au départ (sauf les modules non progressifs)", () => {
    expect(unlockedModules(0)).toHaveLength(0);
    expect(isUnlocked("timeline", 0)).toBe(false);
    expect(isUnlocked("fiche", 0)).toBe(true);
  });

  it("débloque dans l'ordre : timeline → quêtes → stats → …", () => {
    expect(unlockedModules(3).map((m) => m.key)).toEqual(["timeline"]);
    expect(unlockedModules(5).map((m) => m.key)).toEqual([
      "timeline",
      "quests",
    ]);
    expect(unlockedModules(30)).toHaveLength(6);
  });

  it("le teaser annonce le prochain module et le reste à faire", () => {
    expect(nextUnlock(0)).toMatchObject({
      module: { key: "timeline" },
      remaining: 3,
    });
    expect(nextUnlock(4)).toMatchObject({
      module: { key: "quests" },
      remaining: 1,
    });
    expect(nextUnlock(30)).toBeNull();
  });

  it("détecte les franchissements entre deux totaux", () => {
    expect(newlyUnlocked(2, 3).map((m) => m.key)).toEqual(["timeline"]);
    expect(newlyUnlocked(4, 12).map((m) => m.key)).toEqual([
      "quests",
      "stats",
    ]);
    expect(newlyUnlocked(3, 4)).toHaveLength(0);
  });
});
