"use client";

/**
 * Ticket 11 — timeline virtualisée : pagination par curseur, filtres attribut
 * + recherche plein texte, rendu virtualisé (@tanstack/react-virtual).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search, Trash2, Users } from "lucide-react";
import {
  ATTRIBUTE_LIST,
  ATTRIBUTES,
  type AttributeCode,
} from "@/lib/attributes";
import { cn } from "@/lib/utils";

interface TimelineItem {
  log: {
    id: string;
    occurredAt: string;
    durationMin: number | null;
    note: string | null;
    mood: number | null;
    tags: string[] | null;
    mediaUrls: string[] | null;
    visibility: string;
  };
  type: {
    id: string;
    label: string;
    attributeCode: string;
    secondaryAttributeCode: string | null;
  };
  xpTotal: number;
}

const MOODS = ["😞", "😕", "😐", "🙂", "🤩"];

export function TimelineClient() {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [attribute, setAttribute] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const parentRef = useRef<HTMLDivElement>(null);
  // Garde synchrone contre les fetches concurrents (l'état `loading` est asynchrone).
  const inFlight = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (reset: boolean, currentCursor: string | null) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setLoading(true);
      const params = new URLSearchParams({ limit: "25" });
      if (!reset && currentCursor) params.set("cursor", currentCursor);
      if (attribute) params.set("attribute", attribute);
      if (qDebounced) params.set("q", qDebounced);
      const res = await fetch(`/api/logs?${params}`);
      inFlight.current = false;
      setLoading(false);
      if (!res.ok) return;
      const data = await res.json();
      setItems((prev) => (reset ? data.items : [...prev, ...data.items]));
      setCursor(data.nextCursor);
      setHasMore(Boolean(data.nextCursor));
    },
    [attribute, qDebounced],
  );

  useEffect(() => {
    load(true, null);
  }, [load]);

  const virtualizer = useVirtualizer({
    count: items.length + (hasMore ? 1 : 0),
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Charge la page suivante quand la sentinelle devient visible
  // (jamais avant la première page : le chargement initial s'en charge).
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (!last || items.length === 0) return;
    if (last.index >= items.length && hasMore && !loading) {
      load(false, cursor);
    }
  }, [virtualItems, items.length, hasMore, loading, cursor, load]);

  async function remove(id: string) {
    setItems((prev) => prev.filter((i) => i.log.id !== id));
    await fetch(`/api/logs/${id}`, { method: "DELETE" });
  }

  /** Partage opt-in au fil de guilde (GLD-2). */
  async function toggleShare(item: TimelineItem) {
    const next = item.log.visibility === "guild" ? "private" : "guild";
    const res = await fetch(`/api/logs/${item.log.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: next }),
    });
    if (res.ok) {
      setItems((prev) =>
        prev.map((i) =>
          i.log.id === item.log.id
            ? { ...i, log: { ...i.log, visibility: next } }
            : i,
        ),
      );
    }
  }

  return (
    <div>
      {/* Filtres */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher…"
            className="rounded-xl border border-border-default bg-surface py-2 pl-8 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={() => setAttribute(null)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            attribute === null
              ? "bg-accent text-white"
              : "bg-surface text-muted hover:text-foreground",
          )}
        >
          Tous
        </button>
        {ATTRIBUTE_LIST.map((attr) => (
          <button
            key={attr.code}
            type="button"
            onClick={() =>
              setAttribute(attribute === attr.code ? null : attr.code)
            }
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-bold transition-colors",
              attribute === attr.code
                ? "text-background"
                : "bg-surface text-muted hover:text-foreground",
            )}
            style={
              attribute === attr.code ? { backgroundColor: attr.color } : {}
            }
          >
            {attr.code}
          </button>
        ))}
      </div>

      {/* Liste virtualisée */}
      <div
        ref={parentRef}
        className="h-[65vh] overflow-y-auto rounded-2xl border border-border-default bg-surface"
      >
        {items.length === 0 && !loading ? (
          <p className="p-6 text-sm text-muted">
            Aucun log — utilise le bouton + pour commencer.
          </p>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {virtualItems.map((vi) => {
              if (vi.index >= items.length) {
                return (
                  <div
                    key="loader"
                    className="absolute left-0 top-0 flex w-full items-center justify-center p-4 text-sm text-muted"
                    style={{ transform: `translateY(${vi.start}px)` }}
                  >
                    Chargement…
                  </div>
                );
              }
              const item = items[vi.index];
              const attr =
                ATTRIBUTES[item.type.attributeCode as AttributeCode];
              const date = new Date(item.log.occurredAt);
              return (
                <div
                  key={item.log.id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full border-b border-border-default px-5 py-3"
                  style={{ transform: `translateY(${vi.start}px)` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="stat-number text-[10px] font-bold"
                          style={{ color: attr?.color }}
                        >
                          {item.type.attributeCode}
                        </span>
                        <span className="truncate font-medium">
                          {item.type.label}
                        </span>
                        {item.log.mood && (
                          <span>{MOODS[item.log.mood - 1]}</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {date.toLocaleDateString("fr-FR", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        ·{" "}
                        {date.toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {item.log.durationMin
                          ? ` · ${item.log.durationMin} min`
                          : ""}
                      </p>
                      {item.log.note && (
                        <p className="mt-1 truncate text-sm text-muted">
                          {item.log.note}
                        </p>
                      )}
                      {item.log.tags && item.log.tags.length > 0 && (
                        <div className="mt-1 flex gap-1">
                          {item.log.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] text-muted"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className="stat-number text-sm font-bold"
                        style={{ color: attr?.color }}
                      >
                        +{item.xpTotal} XP
                      </span>
                      <button
                        type="button"
                        aria-label={
                          item.log.visibility === "guild"
                            ? "Ne plus partager à la guilde"
                            : "Partager à la guilde"
                        }
                        title="Partager au fil de guilde"
                        onClick={() => toggleShare(item)}
                        className={cn(
                          "transition-colors",
                          item.log.visibility === "guild"
                            ? "text-accent"
                            : "text-muted hover:text-foreground",
                        )}
                      >
                        <Users size={15} />
                      </button>
                      <button
                        type="button"
                        aria-label="Supprimer ce log"
                        onClick={() => remove(item.log.id)}
                        className="text-muted transition-colors hover:text-attr-str"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
