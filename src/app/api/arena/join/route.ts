import { NextResponse } from "next/server";
import { db } from "@/db";
import { joinArena } from "@/lib/arenaService";
import { checkAchievements } from "@/lib/achievementService";
import { apiUser } from "@/lib/session";

/** POST /api/arena/join — inscription à la ligue de la saison (opt-in). */
export async function POST() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const result = await joinArena(db, user.id);
  const unlocked = await checkAchievements(db, user);
  return NextResponse.json({ ...result, unlocked });
}
