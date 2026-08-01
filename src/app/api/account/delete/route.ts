import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { apiUser } from "@/lib/session";

/**
 * POST /api/account/delete — départ facile (PRD §11.7) : suppression
 * définitive en self-service, sans friction de rétention. Toutes les données
 * liées partent en cascade (FK onDelete: cascade).
 */
export async function POST() {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  await db.delete(users).where(eq(users.id, user.id));
  return NextResponse.json({ deleted: true });
}
