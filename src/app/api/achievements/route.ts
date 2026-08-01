import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { achievements, userAchievements } from "@/db/schema";
import { apiUser } from "@/lib/session";

/** GET /api/achievements — tous les succès + état de déblocage. */
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const [all, mine] = await Promise.all([
    db.select().from(achievements),
    db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, user.id)),
  ]);
  const unlockedById = new Map(mine.map((m) => [m.achievementId, m.unlockedAt]));

  return NextResponse.json({
    items: all.map((a) => ({
      code: a.code,
      title: a.title,
      description: a.description,
      rarity: a.rarity,
      unlockedAt: unlockedById.get(a.id) ?? null,
    })),
  });
}
