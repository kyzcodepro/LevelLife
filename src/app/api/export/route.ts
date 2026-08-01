import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  checkins,
  habits,
  logs,
  lqiScores,
  profiles,
  streaks,
  userAttributes,
  xpEvents,
} from "@/db/schema";
import { apiUser } from "@/lib/session";

/**
 * GET /api/export — export RGPD complet en self-service (PRD §12) :
 * toutes les données de l'utilisateur en JSON, sans friction.
 */
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const [profile, attrs, userLogs, events, userHabits, userStreaks, userCheckins, scores] =
    await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
      db.select().from(userAttributes).where(eq(userAttributes.userId, user.id)),
      db.select().from(logs).where(eq(logs.userId, user.id)),
      db.select().from(xpEvents).where(eq(xpEvents.userId, user.id)),
      db.select().from(habits).where(eq(habits.userId, user.id)),
      db.select().from(streaks).where(eq(streaks.userId, user.id)),
      db.select().from(checkins).where(eq(checkins.userId, user.id)),
      db.select().from(lqiScores).where(eq(lqiScores.userId, user.id)),
    ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    user: {
      email: user.email,
      username: user.username,
      timezone: user.timezone,
      locale: user.locale,
      createdAt: user.createdAt,
    },
    profile,
    attributes: attrs,
    logs: userLogs,
    xpEvents: events,
    habits: userHabits,
    streaks: userStreaks,
    checkins: userCheckins,
    lqiScores: scores,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ascend-export-${user.username ?? "me"}.json"`,
    },
  });
}
