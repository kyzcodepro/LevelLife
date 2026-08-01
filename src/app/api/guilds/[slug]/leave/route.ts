import { NextResponse } from "next/server";
import { db } from "@/db";
import { leaveGuild } from "@/lib/guildService";
import { apiUser } from "@/lib/session";

/** POST /api/guilds/:slug/leave */
export async function POST() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const ok = await leaveGuild(db, user.id);
  if (!ok) return NextResponse.json({ error: "Pas de guilde" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
