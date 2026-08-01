/**
 * Démarrage serveur Next : applique les migrations PGlite en dev
 * pour que `pnpm dev` fonctionne sans aucune infra.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { migrateDb } = await import("@/db");
    await migrateDb();
  }
}
