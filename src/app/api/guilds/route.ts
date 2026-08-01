import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { createGuild, listPublicGuilds, userGuild } from "@/lib/guildService";
import { apiUser } from "@/lib/session";

/** GET /api/guilds — guildes publiques + la mienne. */
export async function GET() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const [mine, publicGuilds] = await Promise.all([
    userGuild(db, user.id),
    listPublicGuilds(db),
  ]);
  return NextResponse.json({ mine, publicGuilds });
}

const createSchema = z.object({
  name: z.string().min(2).max(40),
  visibility: z.enum(["public", "private"]),
});

/** POST /api/guilds — créer une guilde (GLD-1). */
export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  const result = await createGuild(db, user.id, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}
