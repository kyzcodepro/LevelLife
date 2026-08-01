/**
 * Seed idempotent : 8 attributs + 60 types d'activité système.
 * Usage : pnpm db:seed (nécessite DATABASE_URL).
 */

import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { ATTRIBUTE_LIST } from "@/lib/attributes";
import { activityTypes, attributes } from "./schema";
import { SYSTEM_ACTIVITY_TYPES } from "./seed-data";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquant — voir .env.example");

  const client = postgres(url, { prepare: false, max: 1 });
  const db = drizzle(client);

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
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
