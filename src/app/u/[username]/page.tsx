import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  profiles,
  userAchievements,
  userAttributes,
  users,
} from "@/db/schema";
import {
  ATTRIBUTE_LIST,
  type AttributeCode,
} from "@/lib/attributes";
import { titleForLevel } from "@/lib/titles";
import { globalLevel, levelFromXp } from "@/lib/xp";
import { AttributeRadar } from "@/components/ui/AttributeRadar";
import { Sigil } from "@/components/ui/Sigil";
import { StatBar } from "@/components/ui/StatBar";

/**
 * AVA-6 — Profil public `/u/pseudo` : privé par défaut, granularité par
 * attribut. Le LQI n'apparaît JAMAIS ici (PRD §11.4).
 */
export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  const profile = user
    ? await db.query.profiles.findFirst({
        where: eq(profiles.userId, user.id),
      })
    : null;

  if (!user || !profile || profile.visibility !== "public") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Ascend
        </p>
        <h1 className="mt-2 text-2xl font-bold">Profil privé</h1>
        <p className="mt-2 text-sm text-muted">
          Ce profil n'existe pas ou n'est pas public. Privé par défaut, comme
          tout le reste.
        </p>
      </main>
    );
  }

  const publicCodes = new Set(
    (profile.publicAttributes ?? []) as AttributeCode[],
  );
  const [attrs, [{ achievementCount }]] = await Promise.all([
    db.select().from(userAttributes).where(eq(userAttributes.userId, user.id)),
    db
      .select({ achievementCount: sql<number>`count(*)::int` })
      .from(userAchievements)
      .where(eq(userAchievements.userId, user.id)),
  ]);

  const xpByCode = Object.fromEntries(
    attrs.map((a) => [a.attributeCode, a.xpTotal]),
  ) as Record<AttributeCode, number>;
  const levels = Object.fromEntries(
    ATTRIBUTE_LIST.map((a) => [
      a.code,
      levelFromXp(xpByCode[a.code] ?? 0).level,
    ]),
  ) as Record<AttributeCode, number>;
  const weights = (profile.attributeWeights ?? {}) as Record<string, number>;
  const shown = ATTRIBUTE_LIST.filter((a) => publicCodes.has(a.code));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">
          Ascend
        </p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <Sigil
              seed={user.username!}
              color={
                shown[0]
                  ? shown.reduce((best, a) =>
                      (xpByCode[a.code] ?? 0) > (xpByCode[best.code] ?? 0)
                        ? a
                        : best,
                    ).color
                  : "#7C5CFF"
              }
              level={globalLevel(levels, weights)}
              size={80}
            />
            <div>
              <h1 className="font-[family-name:var(--font-space-grotesk)] text-4xl font-bold">
                {user.username}
              </h1>
              <p
                className="stat-number text-sm font-bold uppercase tracking-widest"
                style={{ color: titleForLevel(globalLevel(levels, weights)).color }}
              >
                {titleForLevel(globalLevel(levels, weights)).title}
              </p>
              {profile.bio && (
                <p className="mt-1 text-sm text-muted">{profile.bio}</p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-border-default bg-surface px-6 py-4 text-right">
            <p className="text-xs uppercase tracking-wider text-muted">
              Niveau global
            </p>
            <p className="stat-number text-4xl font-bold text-accent">
              {globalLevel(levels, weights)}
            </p>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">
          {achievementCount} succès débloqués
        </p>
      </header>

      {shown.length === 0 ? (
        <p className="text-sm text-muted">
          {user.username} n'affiche aucun attribut publiquement.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Le radar n'apparaît que si les 8 attributs sont publics —
              sinon les axes masqués afficheraient un faux niveau 1. */}
          {shown.length === 8 && (
            <section className="rounded-2xl border border-border-default bg-surface p-6">
              <AttributeRadar
                levels={Object.fromEntries(
                  shown.map((a) => [a.code, levels[a.code]]),
                )}
              />
            </section>
          )}
          <section className="rounded-2xl border border-border-default bg-surface p-6">
            <div className="flex flex-col gap-4">
              {shown.map((attr) => {
                const p = levelFromXp(xpByCode[attr.code] ?? 0);
                return (
                  <StatBar
                    key={attr.code}
                    attribute={attr.code}
                    level={p.level}
                    progress={p.progress}
                  />
                );
              })}
            </div>
          </section>
        </div>
      )}

      <footer className="mt-10 text-center text-xs text-muted">
        Fait avec ASCEND — la vie réelle, en progression mesurable.
      </footer>
    </main>
  );
}
