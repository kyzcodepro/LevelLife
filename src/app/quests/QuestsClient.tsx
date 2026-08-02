"use client";

/**
 * Ticket 15 — UI quêtes : cartes journalières/hebdo, progression, reroll,
 * complétion. Ticket 16 — habitudes + streaks + Mode Repos.
 */

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Dices, Flame, Snowflake } from "lucide-react";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { localDateStr } from "@/lib/dates";
import { cn } from "@/lib/utils";

interface QuestRow {
  instance: {
    id: string;
    status: string;
    progress: { current?: number; target?: number } | null;
    assignedAt: string;
  };
  quest: {
    id: string;
    scope: string;
    title: string;
    description: string | null;
    target: { attributeCode?: string; count?: number } | null;
    xpReward: number;
  };
}

interface HabitRow {
  habit: { id: string };
  type: { id: string; label: string; attributeCode: string };
  streak: {
    id: string;
    current: number;
    best: number;
    lifetimeTotal: number;
    lastDoneOn: string | null;
    freezesLeft: number;
  } | null;
}

export function QuestsClient() {
  const [questRows, setQuestRows] = useState<QuestRow[]>([]);
  const [habitRows, setHabitRows] = useState<HabitRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [questsRes, habitsRes] = await Promise.all([
      fetch("/api/quests/active"),
      fetch("/api/habits"),
    ]);
    if (questsRes.ok) setQuestRows((await questsRes.json()).items);
    if (habitsRes.ok) setHabitRows((await habitsRes.json()).items);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function reroll(instanceId: string) {
    const res = await fetch(`/api/quests/${instanceId}/reroll`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setMessage(body?.error ?? "Reroll impossible");
      setTimeout(() => setMessage(null), 4000);
    }
    refresh();
  }

  async function freeze(habitId: string) {
    const res = await fetch(`/api/habits/${habitId}/freeze`, {
      method: "POST",
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(body?.error ?? "Gel impossible");
    } else {
      setMessage("Journée gelée — streak protégé, repose-toi. ❄️");
    }
    setTimeout(() => setMessage(null), 4000);
    refresh();
  }

  const today = localDateStr(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const isToday = (iso: string) =>
    localDateStr(new Date(iso), Intl.DateTimeFormat().resolvedOptions().timeZone) === today;

  const dailies = questRows.filter(
    (r) =>
      r.quest.scope === "daily" &&
      (r.instance.status === "active" || isToday(r.instance.assignedAt)),
  );
  const weeklies = questRows.filter(
    (r) =>
      r.quest.scope === "weekly" &&
      (r.instance.status === "active" || r.instance.status === "completed"),
  );

  function QuestCard({ row, canReroll }: { row: QuestRow; canReroll: boolean }) {
    const attr = row.quest.target?.attributeCode
      ? ATTRIBUTES[row.quest.target.attributeCode as AttributeCode]
      : null;
    const progress = row.instance.progress ?? {};
    const current = progress.current ?? 0;
    const target = progress.target ?? row.quest.target?.count ?? 1;
    const done = row.instance.status === "completed";
    const pct = done ? 100 : Math.min(100, Math.round((current / target) * 100));

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl border bg-surface p-5 transition-opacity",
          done ? "border-attr-vit/50" : "border-border-default",
        )}
        style={
          done ? { boxShadow: "0 0 20px rgba(52, 211, 153, 0.12)" } : undefined
        }
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {done && (
                <motion.span
                  initial={{ scale: 0, rotate: -90 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 14 }}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-attr-vit text-background"
                >
                  <Check size={13} strokeWidth={3} />
                </motion.span>
              )}
              {attr && (
                <span
                  className="stat-number text-[10px] font-bold"
                  style={{ color: attr.color }}
                >
                  {attr.code}
                </span>
              )}
              <h3 className={cn("font-medium", done && "text-muted line-through")}>
                {row.quest.title}
              </h3>
            </div>
            {row.quest.description && (
              <p className="mt-1 text-sm text-muted">{row.quest.description}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="stat-number text-sm font-bold text-accent">
              +{row.quest.xpReward} XP
            </span>
            {canReroll && !done && (
              <button
                type="button"
                title="Reroll (1 gratuit/jour)"
                onClick={() => reroll(row.instance.id)}
                className="rounded-lg p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                <Dices size={16} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-raised">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              style={{
                backgroundColor: done
                  ? "var(--attr-vit)"
                  : (attr?.color ?? "var(--accent)"),
                boxShadow: `0 0 8px ${done ? "rgba(52,211,153,0.5)" : (attr?.color ?? "#7C5CFF") + "55"}`,
              }}
            />
          </div>
          <span className="stat-number text-xs text-muted">
            {done ? "Fait !" : `${current}/${target}`}
          </span>
        </div>
      </motion.div>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted">Chargement des quêtes…</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {message && (
        <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Journalières
        </h2>
        <div className="flex flex-col gap-3">
          {dailies.length === 0 ? (
            <p className="text-sm text-muted">Aucune quête aujourd'hui.</p>
          ) : (
            dailies.map((row) => (
              <QuestCard key={row.instance.id} row={row} canReroll />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Hebdomadaires
        </h2>
        <div className="flex flex-col gap-3">
          {weeklies.length === 0 ? (
            <p className="text-sm text-muted">Aucune quête cette semaine.</p>
          ) : (
            weeklies.map((row) => (
              <QuestCard key={row.instance.id} row={row} canReroll={false} />
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Habitudes & streaks
        </h2>
        <div className="flex flex-col gap-3">
          {habitRows.length === 0 ? (
            <p className="text-sm text-muted">Aucune habitude suivie.</p>
          ) : (
            habitRows.map((row) => {
              const attr = ATTRIBUTES[row.type.attributeCode as AttributeCode];
              const doneToday = row.streak?.lastDoneOn === today;
              return (
                <div
                  key={row.habit.id}
                  className="flex items-center justify-between rounded-2xl border border-border-default bg-surface px-5 py-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="stat-number text-[10px] font-bold"
                        style={{ color: attr?.color }}
                      >
                        {row.type.attributeCode}
                      </span>
                      <span className="font-medium">{row.type.label}</span>
                      {doneToday && (
                        <span className="text-xs text-attr-vit">
                          ✓ aujourd'hui
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {/* Pas de streak-shaming : le cumul vie est mis en avant. */}
                      {row.streak
                        ? `${row.streak.lifetimeTotal} jours au total · record ${row.streak.best}`
                        : "Pas encore commencé"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1 text-attr-dis">
                      <Flame size={16} />
                      <span className="stat-number text-lg font-bold">
                        {row.streak?.current ?? 0}
                      </span>
                    </span>
                    <button
                      type="button"
                      disabled={
                        !row.streak || doneToday || row.streak.freezesLeft <= 0
                      }
                      onClick={() => freeze(row.habit.id)}
                      title="Mode Repos : gèle le streak pour aujourd'hui"
                      className="flex items-center gap-1 rounded-lg border border-border-default px-2.5 py-1.5 text-xs text-attr-zen transition-colors hover:bg-accent-soft disabled:opacity-30"
                    >
                      <Snowflake size={13} />
                      {row.streak?.freezesLeft ?? 0}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <p className="mt-3 text-xs text-muted">
          Mode Repos : 2 gels par mois, sans pénalité. Un streak perdu garde
          son total cumulé — jamais de compteur rouge.
        </p>
      </section>
    </div>
  );
}
