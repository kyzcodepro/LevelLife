import { NextResponse } from "next/server";
import { db } from "@/db";
import { leagueStandings } from "@/lib/arenaService";
import { apiUser } from "@/lib/session";

/** GET /api/arena — saison courante + classement de ma ligue (ARN-1/2). */
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const result = await leagueStandings(db, user.id);
  return NextResponse.json({ ...result, viewerId: user.id });
}
