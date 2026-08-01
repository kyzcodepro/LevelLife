import { NextRequest, NextResponse } from "next/server";
import { and, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityTypes, habits, streaks } from "@/db/schema";
import { apiUser } from "@/lib/session";

/** GET /api/habits — habitudes + streaks de l'utilisateur. */
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const rows = await db
    .select({ habit: habits, type: activityTypes, streak: streaks })
    .from(habits)
    .innerJoin(activityTypes, eq(habits.activityTypeId, activityTypes.id))
    .leftJoin(streaks, eq(streaks.habitId, habits.id))
    .where(and(eq(habits.userId, user.id), eq(habits.active, true)));

  return NextResponse.json({ items: rows });
}

const createHabitSchema = z.object({ activityTypeId: z.uuid() });

/** POST /api/habits — suivre un type d'activité en habitude quotidienne. */
export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = createHabitSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const [type] = await db
    .select()
    .from(activityTypes)
    .where(
      and(
        eq(activityTypes.id, parsed.data.activityTypeId),
        or(isNull(activityTypes.userId), eq(activityTypes.userId, user.id)),
      ),
    );
  if (!type) {
    return NextResponse.json({ error: "Type introuvable" }, { status: 404 });
  }

  const existing = await db
    .select()
    .from(habits)
    .where(
      and(eq(habits.userId, user.id), eq(habits.activityTypeId, type.id)),
    );
  if (existing.length > 0) {
    await db
      .update(habits)
      .set({ active: true })
      .where(eq(habits.id, existing[0].id));
    return NextResponse.json({ ok: true, habitId: existing[0].id });
  }

  const [habit] = await db
    .insert(habits)
    .values({
      userId: user.id,
      activityTypeId: type.id,
      cadence: { type: "daily" },
    })
    .returning();
  return NextResponse.json({ ok: true, habitId: habit.id }, { status: 201 });
}
