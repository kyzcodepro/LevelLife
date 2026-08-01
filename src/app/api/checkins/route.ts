import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { checkins } from "@/db/schema";
import { localDateStr, weekStartStr } from "@/lib/dates";
import { computeWeeklyLqi } from "@/lib/lqi";
import { apiUser } from "@/lib/session";

const slider = z.number().int().min(1).max(10);
const checkinSchema = z.object({
  energy: slider,
  mood: slider,
  meaning: slider,
  relations: slider,
  stress: slider,
  satisfaction: slider,
  note: z.string().max(2000).nullish(),
});

/** POST /api/checkins — check-in hebdo (6 curseurs) → déclenche le calcul du LQI. */
export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = checkinSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Requête invalide", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const weekStart = weekStartStr(localDateStr(new Date(), user.timezone));

  await db
    .insert(checkins)
    .values({ userId: user.id, weekStart, ...parsed.data })
    .onConflictDoUpdate({
      target: [checkins.userId, checkins.weekStart],
      set: parsed.data,
    });

  const result = await computeWeeklyLqi(db, user, weekStart);
  return NextResponse.json({ ok: true, weekStart, ...result }, { status: 201 });
}
