"use client";

/**
 * M5 — Arène : saison courante, ligue fermée de 30 joueurs de niveau proche.
 * Jamais de classement mondial. Récompenses purement cosmétiques.
 */

import { useCallback, useEffect, useState } from "react";
import { Medal } from "lucide-react";
import { cn } from "@/lib/utils";

interface ArenaData {
  season: { name: string; startsAt: string; endsAt: string };
  league: { id: string; tier: number } | null;
  standings: { userId: string; points: number; username: string | null }[];
  viewerId: string;
}

export function ArenaClient() {
  const [data, setData] = useState<ArenaData | null>(null);
  const [joining, setJoining] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/arena");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function join() {
    setJoining(true);
    await fetch("/api/arena/join", { method: "POST" });
    setJoining(false);
    refresh();
  }

  if (!data) return <p className="text-sm text-muted">Chargement…</p>;

  const endsAt = new Date(data.season.endsAt);
  const daysLeft = Math.max(
    0,
    Math.ceil((endsAt.getTime() - Date.now()) / (24 * 3600 * 1000)),
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <p className="text-xs uppercase tracking-wider text-muted">
          Saison en cours
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold">
            {data.season.name}
          </h2>
          <span className="stat-number text-sm text-muted">
            {daysLeft} jours restants
          </span>
        </div>
        <p className="mt-2 text-sm text-muted">
          Ligues fermées de 30 joueurs de niveau proche — jamais de classement
          mondial. Les récompenses sont cosmétiques : badge, titre. Aucun
          avantage de progression, et ton XP total ne reset jamais.
        </p>
      </section>

      {!data.league ? (
        <section className="rounded-2xl border border-border-default bg-surface p-8 text-center">
          <p className="mb-4 text-muted">
            Tu n'es pas encore inscrit à la saison.
          </p>
          <button
            type="button"
            disabled={joining}
            onClick={join}
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-white disabled:opacity-40"
          >
            {joining ? "Inscription…" : "Rejoindre une ligue"}
          </button>
        </section>
      ) : (
        <section className="rounded-2xl border border-border-default bg-surface p-6">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
            Ma ligue — palier {data.league.tier + 1} ({data.standings.length}
            /30)
          </h3>
          <ol className="flex flex-col gap-2">
            {data.standings.map((row, i) => (
              <li
                key={row.userId}
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-2.5 text-sm",
                  row.userId === data.viewerId
                    ? "bg-accent-soft"
                    : i % 2 === 0
                      ? "bg-surface-raised/50"
                      : "",
                )}
              >
                <span className="flex items-center gap-3">
                  <span className="stat-number w-6 text-right font-bold text-muted">
                    {i + 1}
                  </span>
                  {i < 3 && (
                    <Medal
                      size={15}
                      className={
                        i === 0
                          ? "text-attr-fin"
                          : i === 1
                            ? "text-muted"
                            : "text-attr-dis"
                      }
                    />
                  )}
                  {row.username}
                  {row.userId === data.viewerId && (
                    <span className="text-xs text-accent">toi</span>
                  )}
                </span>
                <span className="stat-number font-bold">{row.points} pts</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted">
            Les points suivent l'XP gagné pendant la saison. Reset au
            changement de saison — l'XP total, lui, est éternel.
          </p>
        </section>
      )}
    </div>
  );
}
