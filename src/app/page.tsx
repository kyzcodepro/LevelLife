import Link from "next/link";
import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  habits,
  activityTypes,
  lqiScores,
  questInstances,
  quests,
  streaks,
  userAchievements,
  userAttributes,
} from "@/db/schema";
import { currentUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { profiles } from "@/db/schema";
import {
  ATTRIBUTE_LIST,
  type AttributeCode,
} from "@/lib/attributes";
import { globalLevel, levelFromXp } from "@/lib/xp";
import { detectOverdrive } from "@/lib/overdrive";
import { AppNav } from "@/components/AppNav";
import { QuickLogFab } from "@/components/QuickLogFab";
import { AttributeRadar } from "@/components/ui/AttributeRadar";
import { StatBar } from "@/components/ui/StatBar";
import { Flame, Snowflake } from "lucide-react";

export default async function Home() {
  const user = await currentUser();
  if (!user) return <Landing />;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });
  if (!user.username || !profile?.attributeWeights) redirect("/onboarding");

  const [attrs, userStreaks, activeQuests, lastLqi, allAchievements, mineAchievements] = await Promise.all([
    db.select().from(userAttributes).where(eq(userAttributes.userId, user.id)),
    db
      .select({ streak: streaks, habit: habits, type: activityTypes })
      .from(streaks)
      .innerJoin(habits, eq(streaks.habitId, habits.id))
      .innerJoin(activityTypes, eq(habits.activityTypeId, activityTypes.id))
      .where(eq(streaks.userId, user.id)),
    db
      .select({ instance: questInstances, quest: quests })
      .from(questInstances)
      .innerJoin(quests, eq(questInstances.questId, quests.id))
      .where(
        and(
          eq(questInstances.userId, user.id),
          eq(questInstances.status, "active"),
        ),
      )
      .limit(3),
    db
      .select()
      .from(lqiScores)
      .where(eq(lqiScores.userId, user.id))
      .orderBy(desc(lqiScores.weekStart))
      .limit(4),
    db.select().from(achievements),
    db
      .select()
      .from(userAchievements)
      .where(eq(userAchievements.userId, user.id)),
  ]);

  const unlockedIds = new Set(mineAchievements.map((a) => a.achievementId));
  const rarityColor: Record<string, string> = {
    common: "var(--muted)",
    uncommon: "var(--attr-vit)",
    rare: "var(--attr-int)",
    epic: "var(--attr-cre)",
    legendary: "var(--attr-fin)",
  };

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
  const global = globalLevel(levels, weights);
  const overdrive = await detectOverdrive(db, user.id, user.timezone);

  return (
    <>
      <AppNav username={user.username} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
              {user.username}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {lastLqi[0]
                ? `LQI ${Number(lastLqi[0].total).toFixed(0)} / 100 — privé, visible par toi seulement`
                : "Fais ton premier check-in hebdo pour obtenir ton LQI."}
            </p>
          </div>
          <div className="rounded-2xl border border-border-default bg-surface px-6 py-4 text-right">
            <p className="text-xs uppercase tracking-wider text-muted">
              Niveau global
            </p>
            <p className="stat-number text-5xl font-bold text-accent">
              {global}
            </p>
          </div>
        </header>

        {overdrive.flagged && (
          <div className="mb-6 rounded-2xl border border-attr-dis bg-attr-dis/10 px-5 py-4">
            <p className="font-semibold">⚠️ Sur-optimisation détectée</p>
            <p className="mt-1 text-sm text-muted">
              Ton XP grimpe mais ton LQI baisse depuis 3 semaines. Le grind
              vide ne compte pas : une quête de récupération t'attend dans{" "}
              <Link href="/quests" className="text-accent underline">
                tes quêtes
              </Link>
              .
            </p>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-border-default bg-surface p-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
              Attributs
            </h2>
            <AttributeRadar levels={levels} />
          </section>

          <section className="rounded-2xl border border-border-default bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Progression
            </h2>
            <div className="flex flex-col gap-4">
              {ATTRIBUTE_LIST.map((attr) => {
                const p = levelFromXp(xpByCode[attr.code] ?? 0);
                return (
                  <StatBar
                    key={attr.code}
                    attribute={attr.code}
                    level={p.level}
                    progress={p.progress}
                    xpIntoLevel={p.xpIntoLevel}
                    xpForNextLevel={p.xpForNextLevel}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Streaks */}
          <section className="rounded-2xl border border-border-default bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Habitudes
            </h2>
            {userStreaks.length === 0 ? (
              <p className="text-sm text-muted">
                Aucune habitude suivie pour l'instant.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {userStreaks.map(({ streak, type }) => (
                  <li
                    key={streak.id}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{type.label}</span>
                    <span className="flex items-center gap-3 text-sm">
                      <span className="flex items-center gap-1 text-attr-dis">
                        <Flame size={14} />
                        <span className="stat-number font-bold">
                          {streak.current}
                        </span>
                      </span>
                      <span className="text-muted">
                        {streak.lifetimeTotal} j au total
                      </span>
                      <span className="flex items-center gap-1 text-attr-zen">
                        <Snowflake size={13} />
                        {streak.freezesLeft}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Quêtes actives */}
          <section className="rounded-2xl border border-border-default bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
                Quêtes actives
              </h2>
              <Link href="/quests" className="text-xs text-accent">
                Tout voir →
              </Link>
            </div>
            {activeQuests.length === 0 ? (
              <p className="text-sm text-muted">
                Tes quêtes du jour t'attendent sur la page{" "}
                <Link href="/quests" className="text-accent underline">
                  Quêtes
                </Link>
                .
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {activeQuests.map(({ instance, quest }) => {
                  const progress = (instance.progress ?? {}) as {
                    current?: number;
                    target?: number;
                  };
                  return (
                    <li key={instance.id} className="text-sm">
                      <div className="flex items-center justify-between">
                        <span>{quest.title}</span>
                        <span className="stat-number text-xs text-muted">
                          {progress.current ?? 0}/{progress.target ?? 1} · +
                          {quest.xpReward} XP
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Succès (AVA-5) */}
        <section className="mt-6 rounded-2xl border border-border-default bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Succès — {unlockedIds.size}/{allAchievements.length}
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {allAchievements.map((a) => {
              const unlocked = unlockedIds.has(a.id);
              return (
                <div
                  key={a.id}
                  title={a.description ?? undefined}
                  className={
                    unlocked
                      ? "rounded-xl border bg-surface-raised px-3 py-2"
                      : "rounded-xl border border-border-default px-3 py-2 opacity-35"
                  }
                  style={
                    unlocked
                      ? { borderColor: rarityColor[a.rarity] }
                      : undefined
                  }
                >
                  <p
                    className="truncate text-sm font-medium"
                    style={
                      unlocked ? { color: rarityColor[a.rarity] } : undefined
                    }
                  >
                    {a.title}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {a.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <QuickLogFab />
    </>
  );
}

function Landing() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <p className="mb-2 text-sm font-semibold uppercase tracking-[0.4em] text-accent">
        Ascend
      </p>
      <h1 className="max-w-xl font-[family-name:var(--font-space-grotesk)] text-4xl font-bold sm:text-5xl">
        Level up ta vraie vie.
      </h1>
      <p className="mt-4 max-w-md text-muted">
        Répertorie tes actions, vois ta progression en attributs et niveaux,
        améliore ta qualité de vie mesurée — pas juste ton XP.
      </p>
      <Link
        href="/login"
        className="mt-8 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
      >
        Commencer
      </Link>
    </main>
  );
}
