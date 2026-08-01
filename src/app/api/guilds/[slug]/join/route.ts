import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { joinGuild } from "@/lib/guildService";
import { apiUser } from "@/lib/session";

/** POST /api/guilds/:slug/join */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { slug } = await params;
  const result = await joinGuild(db, user, slug);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
