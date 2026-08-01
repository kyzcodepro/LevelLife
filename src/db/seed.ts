/**
 * Seed idempotent : 8 attributs + 60 types d'activité système.
 * Usage : pnpm db:seed (ou pnpm db:setup pour migrations + seed).
 */

import { ATTRIBUTE_LIST } from "@/lib/attributes";
import type { Db } from "./index";
import { activityTypes, attributes } from "./schema";
import { SYSTEM_ACTIVITY_TYPES } from "./seed-data";

export async function runSeed(db: Db): Promise<void> {
  console.log("Seed des 8 attributs…");
  for (const attr of ATTRIBUTE_LIST) {
    await db
      .insert(attributes)
      .values({
        code: attr.code,
        name: attr.name,
        icon: attr.icon,
        color: attr.color,
      })
      .onConflictDoUpdate({
        target: attributes.code,
        set: { name: attr.name, icon: attr.icon, color: attr.color },
      });
  }

  console.log(`Seed des ${SYSTEM_ACTIVITY_TYPES.length} types d'activité…`);
  for (const type of SYSTEM_ACTIVITY_TYPES) {
    await db
      .insert(activityTypes)
      .values({
        code: type.code,
        label: type.label,
        attributeCode: type.attributeCode,
        secondaryAttributeCode: type.secondaryAttributeCode ?? null,
        baseXp: type.baseXp,
        isSystem: true,
        icon: type.icon,
        userId: null,
      })
      .onConflictDoNothing();
  }
  console.log("Seed terminé.");
}
