import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { habits, profiles, users } from "@/db/schema";
import { ATTRIBUTE_CODES } from "@/lib/attributes";
import { ensureUserAttributes } from "@/lib/logService";
import { apiUser } from "@/lib/session";

const onboardingSchema = z.object({
  username: z
    .string()
    .min(2)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "Lettres, chiffres, _ et - uniquement"),
  weights: z.record(z.enum(ATTRIBUTE_CODES), z.number().min(0).max(100)),
  favoriteTypeIds: z.array(z.uuid()).length(3),
});

/**
 * Ticket 5 — fin d'onboarding : pseudo + pondération des attributs
 * + 3 activités favorites (transformées en habitudes quotidiennes).
 */
export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const parsed = onboardingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Requête invalide", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { username, weights, favoriteTypeIds } = parsed.data;

  const taken = await db.query.users.findFirst({
    where: and(eq(users.username, username), ne(users.id, user.id)),
  });
  if (taken) {
    return NextResponse.json({ error: "Pseudo déjà pris" }, { status: 409 });
  }

  // Normalise la pondération pour une somme de 100.
  const sum = ATTRIBUTE_CODES.reduce((s, c) => s + (weights[c] ?? 0), 0);
  const normalized = Object.fromEntries(
    ATTRIBUTE_CODES.map((c) => [
      c,
      sum > 0 ? Math.round(((weights[c] ?? 0) / sum) * 1000) / 10 : 12.5,
    ]),
  );

  await db.transaction(async (tx) => {
    await tx.update(users).set({ username }).where(eq(users.id, user.id));
    await tx
      .insert(profiles)
      .values({
        userId: user.id,
        displayName: username,
        attributeWeights: normalized,
        avatarConfig: { favorites: favoriteTypeIds },
      })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: {
          attributeWeights: normalized,
          avatarConfig: { favorites: favoriteTypeIds },
        },
      });
    for (const typeId of favoriteTypeIds) {
      const existing = await tx
        .select()
        .from(habits)
        .where(
          and(eq(habits.userId, user.id), eq(habits.activityTypeId, typeId)),
        );
      if (existing.length === 0) {
        await tx.insert(habits).values({
          userId: user.id,
          activityTypeId: typeId,
          cadence: { type: "daily" },
        });
      }
    }
  });
  await ensureUserAttributes(db, user.id);

  return NextResponse.json({ ok: true });
}
