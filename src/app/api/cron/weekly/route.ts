import { NextRequest, NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { checkins, users } from "@/db/schema";
import { localDateStr, weekStartStr } from "@/lib/dates";
import { computeWeeklyLqi } from "@/lib/lqi";

export const maxDuration = 300;

/**
 * Ticket 17 — Cron du dimanche 20:00 : (re)calcule le LQI de la semaine pour
 * tous les utilisateurs ayant fait leur check-in. Protégé par CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const allUsers = await db
    .select()
    .from(users)
    .where(isNotNull(users.username));

  let computed = 0;
  for (const user of allUsers) {
    const weekStart = weekStartStr(localDateStr(new Date(), user.timezone));
    const [checkin] = await db
      .select()
      .from(checkins)
      .where(eq(checkins.userId, user.id));
    if (!checkin) continue;
    const result = await computeWeeklyLqi(db, user, weekStart);
    if (result) computed++;
  }

  return NextResponse.json({ ok: true, users: allUsers.length, computed });
}
