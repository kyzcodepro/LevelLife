import Link from "next/link";
import { and, desc, eq, gte } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Flame, Snowflake } from "lucide-react";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  achievements,
  activityTypes,
  habits,
  logs as logsTable,
  lqiScores,
  profiles,
  questInstances,
  quests,
  streaks,
  userAchievements,
  userAttributes,
  xpEvents,
} from "@/db/schema";
import {
  ATTRIBUTE_LIST,
  ATTRIBUTES,
  type AttributeCode,
} from "@/lib/attributes";
import { localDateStr } from "@/lib/dates";
import { detectOverdrive } from "@/lib/overdrive";
import { currentUser } from "@/lib/session";
import { nextTitle, titleForLevel } from "@/lib/titles";
import { isUnlocked, nextUnlock } from "@/lib/unlocks";
import { globalLevel, levelFromXp } from "@/lib/xp";
import { AppNav } from "@/components/AppNav";
import { QuickLogFab } from "@/components/QuickLogFab";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { AttributeOrbs } from "@/components/ui/AttributeOrbs";
import { AttributeRadar } from "@/components/ui/AttributeRadar";
import { FadeIn } from "@/components/ui/FadeIn";
import { LevelRing } from "@/components/ui/LevelRing";
import { Sigil } from "@/components/ui/Sigil";
import { StatBar } from "@/components/ui/StatBar";

export default async function Home() {
  const user = await currentUser();
  if (!user) return <Landing />;

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  });
  if (!user.username || !profile?.attributeWeights) redirect("/onboarding");

  const since36h = new Date(Date.now() - 36 * 3600 * 1000);
  const [
    attrs,
    userStreaks,
    activeQuests,
    lastLqi,
    allAchievements,
    mineAchievements,
    recentEvents,
  ] = await Promise.all([
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
    db
      .select({ amount: xpEvents.amount, createdAt: xpEvents.createdAt })
      .from(xpEvents)
      .where(
        and(eq(xpEvents.userId, user.id), gte(xpEvents.createdAt, since36h)),
      ),
  ]);

  const [{ logsTotal }] = await db
    .select({ logsTotal: sql<number>`count(*)::int` })
    .from(logsTable)
    .where(eq(logsTable.userId, user.id));
  const questsUnlocked = isUnlocked("quests", logsTotal);
  const teaser = nextUnlock(logsTotal);

  const xpByCode = Object.fromEntries(
    attrs.map((a) => [a.attributeCode, a.xpTotal]),
  ) as Record<AttributeCode, number>;
  const progressByCode = Object.fromEntries(
    ATTRIBUTE_LIST.map((a) => [a.code, levelFromXp(xpByCode[a.code] ?? 0)]),
  ) as Record<AttributeCode, ReturnType<typeof levelFromXp>>;
  const levels = Object.fromEntries(
    ATTRIBUTE_LIST.map((a) => [a.code, progressByCode[a.code].level]),
  ) as Record<AttributeCode, number>;
  const weights = (profile.attributeWeights ?? {}) as Record<string, number>;
  const global = globalLevel(levels, weights);
  const avgProgress =
    ATTRIBUTE_LIST.reduce((s, a) => s + progressByCode[a.code].progress, 0) /
    ATTRIBUTE_LIST.length;

  const today = localDateStr(new Date(), user.timezone);
  const xpToday = recentEvents
    .filter((e) => localDateStr(e.createdAt, user.timezone) === today)
    .reduce((s, e) => s + e.amount, 0);
  const bestStreak = Math.max(0, ...userStreaks.map((s) => s.streak.current));
  const overdrive = await detectOverdrive(db, user.id, user.timezone);

  // Titre + emblème teinté par l'attribut dominant.
  const title = titleForLevel(global);
  const next = nextTitle(global);
  const dominant = ATTRIBUTE_LIST.reduce((best, a) =>
    (xpByCode[a.code] ?? 0) > (xpByCode[best.code] ?? 0) ? a : best,
  );

  const unlockedIds = new Set(mineAchievements.map((a) => a.achievementId));
  const rarityColor: Record<string, string> = {
    common: "var(--muted)",
    uncommon: "var(--attr-vit)",
    rare: "var(--attr-int)",
    epic: "var(--attr-cre)",
    legendary: "var(--attr-fin)",
  };

  return (
    <>
      <AppNav username={user.username} logsTotal={logsTotal} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Héros : niveau + le jour en un coup d'œil */}
        <FadeIn>
          <header className="mb-6 flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-border-default bg-surface p-6">
            <div className="flex items-center gap-5">
              <Sigil
                seed={user.username}
                color={dominant.color}
                level={global}
                size={96}
              />
              <div>
                <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
                  {user.username}
                </h1>
                <p
                  className="stat-number text-sm font-bold uppercase tracking-widest"
                  style={{ color: title.color }}
                >
                  {title.title}
                  {next && (
                    <span className="ml-2 font-normal normal-case tracking-normal text-muted">
                      · {next.title} au niveau {next.minLevel}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {xpToday > 0
                    ? "Belle journée — chaque log te rapproche du prochain niveau."
                    : "Rien de loggé aujourd'hui. Une action suffit — bouton + en bas à droite."}
                </p>
              </div>
            </div>
            <div>
              <div className="flex flex-wrap gap-3">
                <div className="rounded-xl bg-surface-raised px-4 py-2">
                  <p className="stat-number text-2xl font-bold text-accent">
                    +<AnimatedNumber value={xpToday} />
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    XP aujourd'hui
                  </p>
                </div>
                <div className="rounded-xl bg-surface-raised px-4 py-2">
                  <p className="stat-number flex items-center gap-1 text-2xl font-bold text-attr-dis">
                    <Flame size={18} className={bestStreak > 0 ? "flame-flicker" : ""} />
                    <AnimatedNumber value={bestStreak} />
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    Meilleur streak
                  </p>
                </div>
                <div className="rounded-xl bg-surface-raised px-4 py-2">
                  <p className="stat-number text-2xl font-bold">
                    {lastLqi[0] ? Number(lastLqi[0].total).toFixed(0) : "—"}
                  </p>
                  <p className="text-[11px] uppercase tracking-wider text-muted">
                    LQI (privé)
                  </p>
                </div>
              </div>
            </div>
            <LevelRing level={global} progress={avgProgress} />
          </header>
        </FadeIn>

        {overdrive.flagged && (
          <FadeIn delay={0.05}>
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
          </FadeIn>
        )}

        {/* À faire maintenant — ou teaser du prochain déblocage */}
        {!questsUnlocked && teaser ? (
          <FadeIn delay={0.08}>
            <section className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">
                🔓 Prochain déblocage : {teaser.module.label}
              </h2>
              <p className="text-sm text-muted">
                Encore{" "}
                <strong className="text-foreground">
                  {teaser.remaining} log{teaser.remaining > 1 ? "s" : ""}
                </strong>{" "}
                pour ouvrir ce module. Une action réelle = un log — bouton +
                en bas à droite.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="xp-shimmer relative h-full overflow-hidden rounded-full bg-accent"
                  style={{
                    width: `${Math.round((logsTotal / teaser.module.threshold) * 100)}%`,
                  }}
                />
              </div>
              <p className="stat-number mt-1 text-right text-xs text-muted">
                {logsTotal}/{teaser.module.threshold}
              </p>
            </section>
          </FadeIn>
        ) : questsUnlocked ? (
        <FadeIn delay={0.08}>
          <section className="mb-6 rounded-2xl border border-accent/30 bg-accent-soft p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-accent">
                ⚔️ Tes quêtes du jour
              </h2>
              <Link href="/quests" className="text-xs text-accent underline">
                Tout voir →
              </Link>
            </div>
            {activeQuests.length === 0 ? (
              <p className="text-sm text-muted">
                Tes 3 quêtes du jour t'attendent sur la page{" "}
                <Link href="/quests" className="text-accent underline">
                  Quêtes
                </Link>{" "}
                — elles se génèrent à l'ouverture.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-3">
                {activeQuests.map(({ instance, quest }) => {
                  const progress = (instance.progress ?? {}) as {
                    current?: number;
                    target?: number;
                  };
                  const current = progress.current ?? 0;
                  const target = progress.target ?? 1;
                  const attr = (quest.target as { attributeCode?: string })
                    ?.attributeCode;
                  const color = attr
                    ? ATTRIBUTES[attr as AttributeCode]?.color
                    : "#7C5CFF";
                  return (
                    <li
                      key={instance.id}
                      className="rounded-xl bg-surface px-4 py-3"
                    >
                      <p className="truncate text-sm font-medium">
                        {quest.title}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, (current / target) * 100)}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className="stat-number text-xs text-muted">
                          {current}/{target}
                        </span>
                        <span
                          className="stat-number text-xs font-bold"
                          style={{ color }}
                        >
                          +{quest.xpReward}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </FadeIn>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-2">
          <FadeIn delay={0.12}>
            <section className="rounded-2xl border border-border-default bg-surface p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
                Attributs
              </h2>
              <AttributeRadar levels={levels} />
            </section>
          </FadeIn>

          <FadeIn delay={0.16}>
            <section className="rounded-2xl border border-border-default bg-surface p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                Progression
              </h2>
              <div className="flex flex-col gap-4">
                {ATTRIBUTE_LIST.map((attr) => {
                  const p = progressByCode[attr.code];
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
          </FadeIn>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Habitudes — seulement quand il y a quelque chose à montrer */}
          {userStreaks.length > 0 && (
          <FadeIn delay={0.2}>
            <section className="rounded-2xl border border-border-default bg-surface p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                Habitudes
              </h2>
              {userStreaks.length === 0 ? (
                <p className="text-sm text-muted">
                  Aucune habitude suivie pour l'instant — gère-les depuis la
                  page{" "}
                  <Link href="/quests" className="text-accent underline">
                    Quêtes
                  </Link>
                  .
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
                          <Flame
                            size={14}
                            className={
                              streak.lastDoneOn === today
                                ? "flame-flicker"
                                : ""
                            }
                          />
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
          </FadeIn>
          )}

          {/* LQI — introduit une fois la Rétro débloquée (15 logs) */}
          {isUnlocked("retro", logsTotal) && (
          <FadeIn delay={0.24}>
            <section className="rounded-2xl border border-border-default bg-surface p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                Qualité de vie
              </h2>
              {lastLqi[0] ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="stat-number text-4xl font-bold text-accent">
                      {Number(lastLqi[0].total).toFixed(0)}
                      <span className="text-lg text-muted">/100</span>
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      LQI — privé, visible par toi seulement.
                    </p>
                  </div>
                  <Link
                    href="/retro"
                    className="rounded-xl border border-border-default px-4 py-2 text-sm transition-colors hover:border-accent"
                  >
                    Voir la rétro →
                  </Link>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted">
                    Ton LQI mesure si ta vie va vraiment mieux — pas juste si
                    tu grindes. 1 minute par semaine.
                  </p>
                  <Link
                    href="/checkin"
                    className="mt-3 inline-block rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    Faire mon premier check-in
                  </Link>
                </div>
              )}
            </section>
          </FadeIn>
          )}
        </div>

        {/* Succès (AVA-5) — apparaît après les premiers logs, version compacte :
            les débloqués + un avant-goût des prochains. */}
        {logsTotal >= 3 && (
        <FadeIn delay={0.28}>
          <section className="mt-6 rounded-2xl border border-border-default bg-surface p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
              Succès — {unlockedIds.size}/{allAchievements.length}
            </h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[...allAchievements]
                .sort(
                  (a, b) =>
                    Number(unlockedIds.has(b.id)) -
                    Number(unlockedIds.has(a.id)),
                )
                .slice(0, Math.max(8, unlockedIds.size + 4))
                .map((a) => {
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
                      {unlocked ? a.title : "🔒 " + a.title}
                    </p>
                    <p className="truncate text-[11px] text-muted">
                      {a.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </FadeIn>
        )}
      </main>
      <QuickLogFab />
    </>
  );
}

function Landing() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      <AttributeOrbs />
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
        className="pulse-glow mt-8 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-opacity hover:opacity-90"
      >
        Commencer
      </Link>
    </main>
  );
}
