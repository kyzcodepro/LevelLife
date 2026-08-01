"use client";

/**
 * M4 — Guildes : hub (créer / rejoindre) ou tableau de bord de ma guilde
 * (objectif collectif, fil opt-in à réactions emoji, membres, modération).
 */

import { useCallback, useEffect, useState } from "react";
import { Crown, Shield, VolumeX } from "lucide-react";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { cn } from "@/lib/utils";

const EMOJIS = ["🔥", "💪", "👏", "⚡", "🫡", "❤️"];

interface GuildSummary {
  guild: { id: string; name: string; slug: string; level: number };
  members: number;
  leaderName: string | null;
}

interface Detail {
  guild: {
    id: string;
    name: string;
    slug: string;
    level: number;
    xpTotal: number;
    visibility: string;
  };
  members: {
    membership: {
      userId: string;
      role: string;
      muted: boolean;
      weeklyContribution: number;
    };
    username: string | null;
  }[];
  isMember: boolean;
  objective: { targetXp: number; progress: number; achieved: boolean };
  feed: {
    log: { id: string; occurredAt: string; note: string | null };
    typeLabel: string;
    attributeCode: string;
    username: string | null;
    reactions: { emoji: string; userId: string }[];
  }[];
  viewerId: string;
}

export function GuildsClient() {
  const [mine, setMine] = useState<{ guild: { slug: string } } | null>(null);
  const [publicGuilds, setPublicGuilds] = useState<GuildSummary[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [name, setName] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/guilds");
    if (!res.ok) return setLoading(false);
    const data = await res.json();
    setMine(data.mine);
    setPublicGuilds(data.publicGuilds);
    if (data.mine) {
      const d = await fetch(`/api/guilds/${data.mine.guild.slug}`);
      if (d.ok) setDetail(await d.json());
    } else {
      setDetail(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  }

  async function create() {
    const res = await fetch("/api/guilds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, visibility }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return flash(body?.error ?? "Création impossible");
    refresh();
  }

  async function join(slug: string) {
    const res = await fetch(`/api/guilds/${slug}/join`, { method: "POST" });
    const body = await res.json().catch(() => null);
    if (!res.ok) return flash(body?.error ?? "Adhésion impossible");
    refresh();
  }

  async function leave() {
    if (!mine) return;
    await fetch(`/api/guilds/${mine.guild.slug}/leave`, { method: "POST" });
    refresh();
  }

  async function moderate(userId: string, action: "kick" | "mute" | "unmute") {
    if (!mine) return;
    const res = await fetch(`/api/guilds/${mine.guild.slug}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, action }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) return flash(body?.error ?? "Action impossible");
    refresh();
  }

  async function react(logId: string, emoji: string) {
    await fetch(`/api/feed/${logId}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    refresh();
  }

  if (loading) return <p className="text-sm text-muted">Chargement…</p>;

  // --- Pas de guilde : créer ou rejoindre --------------------------------
  if (!detail) {
    return (
      <div className="flex flex-col gap-8">
        {message && (
          <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm">
            {message}
          </div>
        )}
        <section className="rounded-2xl border border-border-default bg-surface p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Créer une guilde
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nom de la guilde"
              className="flex-1 rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 outline-none focus:border-accent"
            />
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as "public" | "private")
              }
              className="rounded-xl border border-border-default bg-surface-raised px-3 py-2.5"
            >
              <option value="public">Publique</option>
              <option value="private">Sur invitation</option>
            </select>
            <button
              type="button"
              disabled={name.trim().length < 2}
              onClick={create}
              className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-white disabled:opacity-40"
            >
              Créer
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            3 à 30 membres. La guilde, c'est la raison de revenir quand la
            motivation chute.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Guildes publiques
          </h2>
          {publicGuilds.length === 0 ? (
            <p className="text-sm text-muted">
              Aucune guilde publique pour l'instant — crée la première.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {publicGuilds.map((g) => (
                <div
                  key={g.guild.id}
                  className="flex items-center justify-between rounded-2xl border border-border-default bg-surface px-5 py-4"
                >
                  <div>
                    <p className="font-medium">{g.guild.name}</p>
                    <p className="text-xs text-muted">
                      Niveau {g.guild.level} · {g.members}/30 membres
                      {g.leaderName ? ` · chef ${g.leaderName}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => join(g.guild.slug)}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    Rejoindre
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    );
  }

  // --- Ma guilde ----------------------------------------------------------
  const me = detail.members.find(
    (m) => m.membership.userId === detail.viewerId,
  );
  const canModerate =
    me?.membership.role === "leader" || me?.membership.role === "officer";
  const pct = Math.min(
    100,
    Math.round((detail.objective.progress / detail.objective.targetXp) * 100),
  );

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-2xl font-bold">
              {detail.guild.name}
            </h2>
            <p className="text-sm text-muted">
              Niveau {detail.guild.level} ·{" "}
              <span className="stat-number">{detail.guild.xpTotal}</span> XP
              collectif · {detail.members.length}/30 membres
            </p>
          </div>
          <button
            type="button"
            onClick={leave}
            className="text-xs text-muted underline hover:text-attr-str"
          >
            Quitter
          </button>
        </div>

        {/* Objectif hebdo */}
        <div className="mt-5">
          <div className="mb-1 flex items-baseline justify-between text-sm">
            <span className="font-medium">
              Objectif de la semaine{" "}
              {detail.objective.achieved && (
                <span className="text-attr-vit">— atteint 🎉</span>
              )}
            </span>
            <span className="stat-number text-muted">
              {detail.objective.progress}/{detail.objective.targetXp} XP
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Fil */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Fil de guilde
        </h3>
        {detail.feed.length === 0 ? (
          <p className="text-sm text-muted">
            Rien de partagé — partage un log depuis ta timeline (icône guilde).
          </p>
        ) : (
          <ul className="flex flex-col gap-4">
            {detail.feed.map((item) => {
              const attr = ATTRIBUTES[item.attributeCode as AttributeCode];
              return (
                <li
                  key={item.log.id}
                  className="border-b border-border-default pb-4 last:border-0 last:pb-0"
                >
                  <p className="text-sm">
                    <strong>{item.username}</strong>{" "}
                    <span className="text-muted">a loggé</span>{" "}
                    <span style={{ color: attr?.color }}>{item.typeLabel}</span>
                  </p>
                  {item.log.note && (
                    <p className="mt-1 text-sm text-muted">{item.log.note}</p>
                  )}
                  <div className="mt-2 flex gap-1">
                    {EMOJIS.map((emoji) => {
                      const count = item.reactions.filter(
                        (r) => r.emoji === emoji,
                      ).length;
                      const minereact = item.reactions.some(
                        (r) =>
                          r.emoji === emoji && r.userId === detail.viewerId,
                      );
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => react(item.log.id, emoji)}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-sm transition-colors",
                            minereact
                              ? "bg-accent-soft"
                              : "opacity-50 hover:opacity-100",
                          )}
                        >
                          {emoji}
                          {count > 0 && (
                            <span className="ml-0.5 text-xs">{count}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Membres */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Membres — contribution de la semaine
        </h3>
        <ul className="flex flex-col gap-2">
          {detail.members.map((m) => (
            <li
              key={m.membership.userId}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2">
                {m.membership.role === "leader" && (
                  <Crown size={14} className="text-attr-fin" />
                )}
                {m.membership.role === "officer" && (
                  <Shield size={14} className="text-accent" />
                )}
                {m.username}
                {m.membership.muted && (
                  <VolumeX size={13} className="text-muted" />
                )}
              </span>
              <span className="flex items-center gap-3">
                <span className="stat-number text-muted">
                  {m.membership.weeklyContribution} XP
                </span>
                {canModerate &&
                  m.membership.userId !== detail.viewerId &&
                  m.membership.role !== "leader" && (
                    <span className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          moderate(
                            m.membership.userId,
                            m.membership.muted ? "unmute" : "mute",
                          )
                        }
                        className="text-muted underline hover:text-foreground"
                      >
                        {m.membership.muted ? "unmute" : "mute"}
                      </button>
                      <button
                        type="button"
                        onClick={() => moderate(m.membership.userId, "kick")}
                        className="text-muted underline hover:text-attr-str"
                      >
                        exclure
                      </button>
                    </span>
                  )}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
