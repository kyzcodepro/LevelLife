import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
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
