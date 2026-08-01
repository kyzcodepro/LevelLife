import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { ATTRIBUTE_CODES } from "@/lib/attributes";
import { apiUser } from "@/lib/session";

const schema = z.object({
  visibility: z.enum(["private", "public"]).optional(),
  publicAttributes: z.array(z.enum(ATTRIBUTE_CODES)).optional(),
});

/** PATCH /api/profile — visibilité du profil + granularité par attribut (AVA-6). */
export async function PATCH(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  await db
    .update(profiles)
    .set({
      ...(parsed.data.visibility ? { visibility: parsed.data.visibility } : {}),
      ...(parsed.data.publicAttributes
        ? { publicAttributes: parsed.data.publicAttributes }
        : {}),
    })
    .where(eq(profiles.userId, user.id));

  return NextResponse.json({ ok: true });
}
