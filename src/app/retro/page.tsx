import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { lqiScores, userAttributes } from "@/db/schema";
import { ATTRIBUTES, ATTRIBUTE_CODES, type AttributeCode } from "@/lib/attributes";
import { requireOnboardedUser } from "@/lib/session";
import { AppNav } from "@/components/AppNav";
import { QuickLogFab } from "@/components/QuickLogFab";
import { LqiTrend } from "./LqiTrend";

/**
 * Ticket 19 — Rétrospective : LQI, delta, composantes, 3 insights,
 * quête suggérée. Le LQI reste privé — jamais partagé, jamais classé.
 */
export default async function RetroPage() {
  const { user } = await requireOnboardedUser();

  const scores = await db
    .select()
    .from(lqiScores)
    .where(eq(lqiScores.userId, user.id))
    .orderBy(desc(lqiScores.weekStart))
    .limit(12);

  const latest = scores[0] ?? null;
  const previous = scores[1] ?? null;
  const delta =
    latest && previous
      ? Math.round((Number(latest.total) - Number(previous.total)) * 10) / 10
      : null;

  const attrs = await db
    .select()
    .from(userAttributes)
    .where(eq(userAttributes.userId, user.id));
  const weakest = ATTRIBUTE_CODES.map((code) => ({
    code,
    xp: attrs.find((a) => a.attributeCode === code)?.xpTotal ?? 0,
  })).sort((a, b) => a.xp - b.xp)[0].code as AttributeCode;

  return (
    <>
      <AppNav username={user.username!} />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
          Rétrospective
        </h1>

        {!latest ? (
          <div className="rounded-2xl border border-border-default bg-surface p-8 text-center">
            <p className="mb-4 text-muted">
              Pas encore de LQI : fais ton premier check-in hebdo (1 minute).
            </p>
            <Link
              href="/checkin"
              className="inline-block rounded-xl bg-accent px-6 py-3 font-semibold text-white"
            >
              Faire mon check-in
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Score */}
            <section className="flex flex-wrap items-center justify-between gap-6 rounded-2xl border border-border-default bg-surface p-6">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">
                  LQI — semaine du {latest.weekStart}
                </p>
                <p className="stat-number text-6xl font-bold text-accent">
                  {Number(latest.total).toFixed(0)}
                  <span className="text-2xl text-muted">/100</span>
                </p>
                {delta !== null && (
                  <p
                    className={
                      delta >= 0 ? "text-attr-vit" : "text-attr-str"
                    }
                  >
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} pts vs semaine
                    précédente
                  </p>
                )}
              </div>
              <div className="flex gap-6">
                {(
                  [
                    ["Subjectif", latest.subjective, "45 %"],
                    ["Équilibre", latest.balance, "35 %"],
                    ["Momentum", latest.momentum, "20 %"],
                  ] as const
                ).map(([label, value, weight]) => (
                  <div key={label} className="text-center">
                    <p className="stat-number text-2xl font-bold">
                      {Number(value).toFixed(0)}
                    </p>
                    <p className="text-xs text-muted">
                      {label}
                      <br />
                      {weight}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* Tendance */}
            {scores.length > 1 && (
              <section className="rounded-2xl border border-border-default bg-surface p-6">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
                  Tendance ({scores.length} semaines)
                </h2>
                <LqiTrend
                  data={[...scores]
                    .reverse()
                    .map((s) => ({
                      week: s.weekStart.slice(5),
                      total: Number(s.total),
                    }))}
                />
              </section>
            )}

            {/* Insights */}
            <section className="rounded-2xl border border-border-default bg-surface p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
                3 insights
              </h2>
              <ul className="flex flex-col gap-3">
                {((latest.insights ?? []) as string[]).map((insight, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="stat-number shrink-0 font-bold text-accent">
                      {i + 1}.
                    </span>
                    {insight}
                  </li>
                ))}
              </ul>
            </section>

            {/* Quête suggérée */}
            <section className="rounded-2xl border border-accent/40 bg-accent-soft p-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-accent">
                Quête suggérée
              </h2>
              <p className="text-sm">
                Ton attribut le plus faible est{" "}
                <strong style={{ color: ATTRIBUTES[weakest].color }}>
                  {ATTRIBUTES[weakest].name}
                </strong>
                . Tes quêtes hebdo de la semaine le ciblent déjà —{" "}
                <Link href="/quests" className="text-accent underline">
                  vois tes quêtes
                </Link>
                .
              </p>
            </section>

            <div className="text-center">
              <Link
                href="/checkin"
                className="text-sm text-muted underline hover:text-foreground"
              >
                Refaire le check-in de cette semaine
              </Link>
            </div>
          </div>
        )}
      </main>
      <QuickLogFab />
    </>
  );
}
