/**
 * Client base de données à double driver :
 * - postgres-js quand DATABASE_URL pointe vers un vrai Postgres (prod — Neon/Supabase EU)
 * - PGlite (Postgres embarqué, persisté sur disque) sinon — dev sans infra.
 *
 * Les migrations PGlite sont appliquées au démarrage via instrumentation.ts
 * ou `pnpm db:setup`.
 */

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const PGLITE_DIR = process.env.PGLITE_DIR ?? ".pglite";

export function usesPglite(): boolean {
  const url = process.env.DATABASE_URL;
  return !url || !url.startsWith("postgres");
}

function createDb(): Db {
  if (!usesPglite()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const postgres = require("postgres") as typeof import("postgres");
    const { drizzle } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("drizzle-orm/postgres-js") as typeof import("drizzle-orm/postgres-js");
    const client = postgres(process.env.DATABASE_URL!, { prepare: false });
    return drizzle(client, { schema }) as unknown as Db;
  }
  const { PGlite } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("@electric-sql/pglite") as typeof import("@electric-sql/pglite");
  const { drizzle } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("drizzle-orm/pglite") as typeof import("drizzle-orm/pglite");
  const client = new PGlite(PGLITE_DIR);
  return drizzle(client, { schema }) as unknown as Db;
}

// Singleton survivant au HMR de Next.
const globalForDb = globalThis as unknown as { __ascendDb?: Db };

export const db: Db = globalForDb.__ascendDb ?? createDb();
if (!globalForDb.__ascendDb) globalForDb.__ascendDb = db;

/** Applique les migrations (PGlite uniquement — en prod, utiliser drizzle-kit migrate). */
export async function migrateDb(): Promise<void> {
  if (!usesPglite()) return;
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await migrate(db as any, { migrationsFolder: "./drizzle" });
}
