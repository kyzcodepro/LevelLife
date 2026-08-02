import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { logs } from "@/db/schema";
import { AppNav } from "./AppNav";

/**
 * En-tête serveur : compte les logs pour piloter le déverrouillage
 * progressif des modules dans la nav.
 */
export async function AppHeader({
  user,
}: {
  user: { id: string; username: string | null };
}) {
  const [{ logsTotal }] = await db
    .select({ logsTotal: sql<number>`count(*)::int` })
    .from(logs)
    .where(eq(logs.userId, user.id));

  return <AppNav username={user.username ?? ""} logsTotal={logsTotal} />;
}
