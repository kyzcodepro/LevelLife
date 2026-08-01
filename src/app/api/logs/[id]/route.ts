import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { logs } from "@/db/schema";
import { userGuild } from "@/lib/guildService";
import { deleteLog } from "@/lib/logService";
import { apiUser } from "@/lib/session";

/** DELETE /api/logs/:id — annulation d'un log (undo) avec retrait de l'XP. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const { id } = await params;
  const ok = await deleteLog(db, user.id, id);
  if (!ok) return NextResponse.json({ error: "Log introuvable" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}

const patchSchema = z.object({ visibility: z.enum(["private", "guild"]) });

/** PATCH /api/logs/:id — partage opt-in au fil de guilde (GLD-2). */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  if (parsed.data.visibility === "guild") {
    const membership = await userGuild(db, user.id);
    if (!membership) {
      return NextResponse.json({ error: "Rejoins d'abord une guilde" }, { status: 400 });
    }
    if (membership.membership.muted) {
      return NextResponse.json({ error: "Tu es mute dans cette guilde" }, { status: 403 });
    }
  }

  const { id } = await params;
  const [updated] = await db
    .update(logs)
    .set({ visibility: parsed.data.visibility })
    .where(and(eq(logs.id, id), eq(logs.userId, user.id)))
    .returning();
  if (!updated) {
    return NextResponse.json({ error: "Log introuvable" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, visibility: updated.visibility });
}
