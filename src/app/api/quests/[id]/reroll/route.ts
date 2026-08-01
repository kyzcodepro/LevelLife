import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { rerollQuest } from "@/lib/questEngine";
import { apiUser } from "@/lib/session";

/** POST /api/quests/:id/reroll — 1 reroll gratuit par jour sur les journalières. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const result = await rerollQuest(db, user, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
