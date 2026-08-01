/**
 * Setup local : migrations + seed, en une commande (`pnpm db:setup`).
 * Fonctionne avec PGlite (défaut) comme avec un vrai Postgres.
 */
import "dotenv/config";
import { db, migrateDb, usesPglite } from "@/db";
import { runSeed } from "@/db/seed";

async function main() {
  if (usesPglite()) {
    console.log(`Migrations PGlite (${process.env.PGLITE_DIR ?? ".pglite"})…`);
    await migrateDb();
  } else {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    console.log("Migrations Postgres…");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await migrate(db as any, { migrationsFolder: "./drizzle" });
  }
  await runSeed(db);
  console.log("Base prête.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
