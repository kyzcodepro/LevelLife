/**
 * Tests d'intégration du pipeline transactionnel (ticket 7) sur PGlite en mémoire :
 * log → xp_events → user_attributes → level-up, streaks, undo.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import * as schema from "@/db/schema";
import { runSeed } from "@/db/seed";
import { createLog, deleteLog } from "./logService";
import { recalcUserXp } from "./recalc";

let db: Db;
let userId: string;
const TZ = "Europe/Paris";

async function typeByCode(code: string) {
  const [t] = await db
    .select()
    .from(schema.activityTypes)
    .where(eq(schema.activityTypes.code, code));
  return t;
}

async function attr(code: string) {
  const [a] = await db
    .select()
    .from(schema.userAttributes)
    .where(
      and(
        eq(schema.userAttributes.userId, userId),
        eq(schema.userAttributes.attributeCode, code),
      ),
    );
  return a;
}

beforeAll(async () => {
  const client = new PGlite(); // en mémoire
  db = drizzle(client, { schema }) as unknown as Db;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: "./drizzle" });
  await runSeed(db);
  const [user] = await db
    .insert(schema.users)
    .values({ email: "test@dev.local", username: "testeur", timezone: TZ })
    .returning();
  userId = user.id;
});

describe("createLog", () => {
  it("crée le log, l'xp_event et met à jour user_attributes", async () => {
    const muscu = await typeByCode("str_muscu"); // base 45, STR
    const result = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: muscu.id,
    });

    expect(result.awards).toHaveLength(1);
    expect(result.awards[0].attributeCode).toBe("STR");
    expect(result.awards[0].amount).toBe(45);

    const str = await attr("STR");
    expect(str.xpTotal).toBe(45);
    expect(str.level).toBe(1);

    const events = await db
      .select()
      .from(schema.xpEvents)
      .where(eq(schema.xpEvents.logId, result.log.id));
    expect(events).toHaveLength(1);
    expect(events[0].multipliers).toMatchObject({ intensity: 1, quality: 1 });
  });

  it("applique les diminishing returns sur le 2e log du même type", async () => {
    const muscu = await typeByCode("str_muscu");
    const result = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: muscu.id,
    });
    // n = 2 → 45 / 1.35 = 33.3 → 33
    expect(result.awards[0].amount).toBe(33);
  });

  it("crédite l'attribut secondaire à 30 %", async () => {
    const course = await typeByCode("str_course"); // STR + VIT secondaire, base 40
    const result = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: course.id,
    });
    const strAward = result.awards.find((a) => a.attributeCode === "STR");
    const vitAward = result.awards.find((a) => a.attributeCode === "VIT");
    expect(strAward?.amount).toBe(40);
    expect(vitAward?.amount).toBe(12); // 40 × 0.3
  });

  it("détecte le level-up", async () => {
    const certif = await typeByCode("int_certif"); // base 60, INT
    // 2 logs à 60 puis 60/1.35=44 → 104 XP → niveau 2 au 2e log
    await createLog(db, { id: userId, timezone: TZ }, { activityTypeId: certif.id });
    const second = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: certif.id,
    });
    expect(second.levelUps).toEqual([{ attributeCode: "INT", newLevel: 2 }]);
  });

  it("réutilise les valeurs du dernier log comme défauts", async () => {
    const lecture = await typeByCode("int_lecture");
    await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: lecture.id,
      intensity: 1.5,
      durationMin: 45,
    });
    const second = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: lecture.id,
    });
    expect(Number(second.log.intensity)).toBe(1.5);
    expect(second.log.durationMin).toBe(45);
  });

  it("refuse un type d'activité inconnu", async () => {
    await expect(
      createLog(db, { id: userId, timezone: TZ }, {
        activityTypeId: "00000000-0000-0000-0000-000000000000",
      }),
    ).rejects.toThrow("introuvable");
  });
});

describe("streaks", () => {
  it("démarre un streak quand une habitude existe", async () => {
    const meditation = await typeByCode("zen_meditation");
    await db.insert(schema.habits).values({
      userId,
      activityTypeId: meditation.id,
      cadence: { type: "daily" },
    });
    const result = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: meditation.id,
    });
    expect(result.streak).toMatchObject({ current: 1, lifetimeTotal: 1 });

    // Même jour : le streak ne bouge pas.
    const again = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: meditation.id,
    });
    expect(again.streak).toMatchObject({ current: 1, lifetimeTotal: 1 });
  });
});

describe("deleteLog (undo)", () => {
  it("supprime le log et retire l'XP", async () => {
    const epargne = await typeByCode("fin_epargne"); // base 40, FIN
    const before = (await attr("FIN"))?.xpTotal ?? 0;
    const result = await createLog(db, { id: userId, timezone: TZ }, {
      activityTypeId: epargne.id,
    });
    const afterCreate = await attr("FIN");
    expect(afterCreate.xpTotal).toBe(before + result.awards[0].amount);

    const ok = await deleteLog(db, userId, result.log.id);
    expect(ok).toBe(true);
    const afterDelete = await attr("FIN");
    expect(afterDelete.xpTotal).toBe(before);
  });

  it("refuse de supprimer le log d'un autre utilisateur", async () => {
    const [other] = await db
      .insert(schema.users)
      .values({ email: "autre@dev.local", timezone: TZ })
      .returning();
    const muscu = await typeByCode("str_muscu");
    const result = await createLog(db, { id: other.id, timezone: TZ }, {
      activityTypeId: muscu.id,
    });
    const ok = await deleteLog(db, userId, result.log.id);
    expect(ok).toBe(false);
  });
});

describe("recalcUserXp (ticket 8)", () => {
  it("est idempotent et resynchronise user_attributes après rééquilibrage", async () => {
    const before = await db
      .select()
      .from(schema.userAttributes)
      .where(eq(schema.userAttributes.userId, userId));

    // Rejeu sans changement de base_xp → mêmes totaux.
    await recalcUserXp(db, userId, TZ);
    const after = await db
      .select()
      .from(schema.userAttributes)
      .where(eq(schema.userAttributes.userId, userId));
    for (const b of before) {
      const a = after.find((x) => x.attributeCode === b.attributeCode);
      expect(a?.xpTotal).toBe(b.xpTotal);
    }

    // Rééquilibrage : muscu passe de 45 à 90 → l'XP STR doit augmenter.
    const muscu = await typeByCode("str_muscu");
    await db
      .update(schema.activityTypes)
      .set({ baseXp: 90 })
      .where(eq(schema.activityTypes.id, muscu.id));
    const strBefore = (await attr("STR")).xpTotal;
    await recalcUserXp(db, userId, TZ);
    const strAfter = (await attr("STR")).xpTotal;
    expect(strAfter).toBeGreaterThan(strBefore);
  });
});
