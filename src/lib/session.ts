import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { profiles, users } from "@/db/schema";

export type SessionUser = typeof users.$inferSelect;

/** Utilisateur connecté ou null (pour les pages publiques). */
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  return user ?? null;
}

/** Redirige vers /login si non connecté. */
export async function requireUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirige vers /onboarding tant que le pseudo + les pondérations ne sont pas posés. */
export async function requireOnboardedUser(): Promise<{
  user: SessionUser;
  profile: typeof profiles.$inferSelect;
}> {
  const user = await requireUser();
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });
  if (!user.username || !profile?.attributeWeights) redirect("/onboarding");
  return { user, profile };
}

/** Variante API : renvoie null au lieu de rediriger (le handler répond 401). */
export async function apiUser(): Promise<SessionUser | null> {
  return currentUser();
}
