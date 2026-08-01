import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  habits,
  lqiScores,
  profiles,
  streaks,
  userAttributes,
} from "@/db/schema";
import { globalLevel } from "@/lib/xp";
import { apiUser } from "@/lib/session";

/** GET /api/profile/me — fiche perso complète (attributs, niveaux, streaks, LQI). */
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const [profile, attrs, userStreaks, lastLqi] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
    db.select().from(userAttributes).where(eq(userAttributes.userId, user.id)),
    db
      .select({ streak: streaks, habit: habits })
      .from(streaks)
      .innerJoin(habits, eq(streaks.habitId, habits.id))
      .where(eq(streaks.userId, user.id)),
    db
      .select()
      .from(lqiScores)
      .where(eq(lqiScores.userId, user.id))
      .orderBy(desc(lqiScores.weekStart))
      .limit(1),
  ]);

  const levels = Object.fromEntries(
    attrs.map((a) => [a.attributeCode, a.level]),
  );
  const weights = (profile?.attributeWeights ?? {}) as Record<string, number>;

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      timezone: user.timezone,
      tier: user.tier,
    },
    profile,
    attributes: attrs,
    globalLevel: globalLevel(levels, weights),
    streaks: userStreaks,
    lqi: lastLqi[0] ?? null,
  });
}
