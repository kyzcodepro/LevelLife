"use client";

/**
 * Fiche de personnage de démo (données mock) — vitrine du design system M0.
 * Le Quick Log simulé déclenche le vrai moteur XP (lib/xp.ts), le toast
 * et le level-up, en attendant la persistance (EPIC 2, ticket 7).
 */

import { useCallback, useMemo, useRef, useState } from "react";
import {
  ATTRIBUTE_LIST,
  ATTRIBUTES,
  type AttributeCode,
} from "@/lib/attributes";
import { computeXp, globalLevel, levelFromXp } from "@/lib/xp";
import { AttributeRadar } from "@/components/ui/AttributeRadar";
import { LevelUpModal } from "@/components/ui/LevelUpModal";
import { StatBar } from "@/components/ui/StatBar";
import { XPToast, type XPToastData } from "@/components/ui/XPToast";

const INITIAL_XP: Record<AttributeCode, number> = {
  STR: 2450,
  VIT: 1830,
  INT: 4120,
  DIS: 3260,
  SOC: 920,
  CRE: 5480,
  FIN: 1410,
  ZEN: 640,
};

const WEIGHTS: Record<AttributeCode, number> = {
  STR: 15,
  VIT: 10,
  INT: 15,
  DIS: 15,
  SOC: 10,
  CRE: 20,
  FIN: 5,
  ZEN: 10,
};

const QUICK_ACTIONS: {
  label: string;
  attribute: AttributeCode;
  baseXp: number;
}[] = [
  { label: "Musculation", attribute: "STR", baseXp: 45 },
  { label: "Nuit de 7 h+", attribute: "VIT", baseXp: 25 },
  { label: "Lecture", attribute: "INT", baseXp: 30 },
  { label: "Deep work", attribute: "DIS", baseXp: 40 },
  { label: "Appel famille", attribute: "SOC", baseXp: 20 },
  { label: "Side-project", attribute: "CRE", baseXp: 40 },
  { label: "Revue de budget", attribute: "FIN", baseXp: 25 },
  { label: "Méditation", attribute: "ZEN", baseXp: 25 },
];

export default function Home() {
  const [xp, setXp] = useState(INITIAL_XP);
  const [toast, setToast] = useState<XPToastData | null>(null);
  const [levelUp, setLevelUp] = useState<{
    attribute: AttributeCode;
    newLevel: number;
  } | null>(null);
  const logCounts = useRef<Partial<Record<AttributeCode, number>>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useMemo(() => {
    const entries = {} as Record<
      AttributeCode,
      ReturnType<typeof levelFromXp>
    >;
    for (const attr of ATTRIBUTE_LIST) {
      entries[attr.code] = levelFromXp(xp[attr.code]);
    }
    return entries;
  }, [xp]);

  const levels = useMemo(() => {
    const out = {} as Record<AttributeCode, number>;
    for (const attr of ATTRIBUTE_LIST) out[attr.code] = progress[attr.code].level;
    return out;
  }, [progress]);

  const global = globalLevel(levels, WEIGHTS);

  const quickLog = useCallback(
    (action: (typeof QUICK_ACTIONS)[number]) => {
      const n = (logCounts.current[action.attribute] ?? 0) + 1;
      logCounts.current[action.attribute] = n;

      const before = levelFromXp(xp[action.attribute]).level;
      const result = computeXp({
        baseXp: action.baseXp,
        logsOfTypeLast24h: n,
        attributeLevel: before,
        xpEarnedTodayForAttribute: 0,
      });
      const nextXp = xp[action.attribute] + result.awarded;
      const after = levelFromXp(nextXp).level;

      setXp((prev) => ({ ...prev, [action.attribute]: nextXp }));
      setToast({
        id: Date.now(),
        amount: result.awarded,
        attribute: action.attribute,
      });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 4000);

      if (after > before) {
        setLevelUp({ attribute: action.attribute, newLevel: after });
      }
    },
    [xp],
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* En-tête */}
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="mb-1 text-sm font-semibold uppercase tracking-[0.3em] text-accent">
            Ascend
          </p>
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-bold sm:text-4xl">
            Fiche de personnage
          </h1>
          <p className="mt-1 text-sm text-muted">
            Démo M0 — design system + moteur XP réel, données mock.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-border-default bg-surface px-6 py-4">
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-muted">
              Niveau global
            </p>
            <p className="stat-number text-5xl font-bold text-accent">
              {global}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Radar */}
        <section className="rounded-2xl border border-border-default bg-surface p-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted">
            Attributs
          </h2>
          <AttributeRadar levels={levels} />
        </section>

        {/* Barres */}
        <section className="rounded-2xl border border-border-default bg-surface p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Progression
          </h2>
          <div className="flex flex-col gap-4">
            {ATTRIBUTE_LIST.map((attr) => {
              const p = progress[attr.code];
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

      {/* Quick Log simulé */}
      <section className="mt-6 rounded-2xl border border-border-default bg-surface p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Quick Log
          </h2>
          <p className="text-xs text-muted">
            2 taps = loggé · diminishing returns actifs (re-cliquez pour voir)
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={() => quickLog(action)}
              className="group rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-left transition-all hover:border-accent hover:bg-accent-soft"
            >
              <span
                className="stat-number block text-xs font-bold"
                style={{ color: ATTRIBUTES[action.attribute].color }}
              >
                {ATTRIBUTES[action.attribute].code}
              </span>
              <span className="mt-1 block truncate text-sm font-medium">
                {action.label}
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                ~{action.baseXp} XP
              </span>
            </button>
          ))}
        </div>
      </section>

      <XPToast toast={toast} onUndo={() => setToast(null)} />
      <LevelUpModal
        open={levelUp !== null}
        attribute={levelUp?.attribute ?? "STR"}
        newLevel={levelUp?.newLevel ?? 1}
        onClose={() => setLevelUp(null)}
      />
    </main>
  );
}
