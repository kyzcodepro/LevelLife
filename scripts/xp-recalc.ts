/**
 * Ticket 8 — rejoue l'XP de tous les utilisateurs (ou d'un seul via --user=<id>)
 * après un rééquilibrage des base_xp. Usage : pnpm xp:recalc
 */
import "dotenv/config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { recalcUserXp } from "@/lib/recalc";
import { eq } from "drizzle-orm";

async function main() {
  const userArg = process.argv.find((a) => a.startsWith("--user="));
  const targets = userArg
    ? await db.select().from(users).where(eq(users.id, userArg.slice(7)))
    : await db.select().from(users);

  for (const user of targets) {
    const result = await recalcUserXp(db, user.id, user.timezone);
    console.log(
      `${user.username ?? user.email} : ${result.updated} événements rejoués`,
      result.totals,
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
