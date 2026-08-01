import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { habits, streaks } from "@/db/schema";
import { localDateStr } from "@/lib/dates";
import { apiUser } from "@/lib/session";

/**
 * POST /api/habits/:id/freeze — Mode Repos (ticket 16) : gèle le streak pour
 * aujourd'hui sans pénalité. 2 gels par mois, rechargés par le cron mensuel.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const [habit] = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, id), eq(habits.userId, user.id)));
  if (!habit) {
    return NextResponse.json({ error: "Habitude introuvable" }, { status: 404 });
  }

  const today = localDateStr(new Date(), user.timezone);
  const [streak] = await db
    .select()
    .from(streaks)
    .where(and(eq(streaks.userId, user.id), eq(streaks.habitId, habit.id)));

  if (!streak) {
    return NextResponse.json(
      { error: "Aucun streak à geler — commence par logger" },
      { status: 400 },
    );
  }
  if (streak.lastDoneOn === today) {
    return NextResponse.json(
      { error: "Déjà validé aujourd'hui — pas besoin de gel" },
      { status: 400 },
    );
  }
  if (streak.freezesLeft <= 0) {
    return NextResponse.json(
      { error: "Plus de gel disponible ce mois-ci" },
      { status: 400 },
    );
  }

  // Le gel marque le jour comme couvert sans toucher au compteur.
  const [updated] = await db
    .update(streaks)
    .set({ lastDoneOn: today, freezesLeft: streak.freezesLeft - 1 })
    .where(eq(streaks.id, streak.id))
    .returning();

  return NextResponse.json({ ok: true, streak: updated });
}
