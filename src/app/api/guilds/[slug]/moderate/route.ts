import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { moderateMember } from "@/lib/guildService";
import { apiUser } from "@/lib/session";

const schema = z.object({
  userId: z.uuid(),
  action: z.enum(["kick", "mute", "unmute"]),
});

/** POST /api/guilds/:slug/moderate — kick / mute / unmute (GLD-6). */
export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const result = await moderateMember(
    db,
    user.id,
    parsed.data.userId,
    parsed.data.action,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
