"use client";

/**
 * Ticket 12 — heatmap annuelle type GitHub + courbes d'XP par attribut.
 */

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ATTRIBUTE_LIST } from "@/lib/attributes";
import { cn } from "@/lib/utils";

interface DayStat {
  day: string;
  total: number;
  byAttribute: Record<string, number>;
}

const RANGES = [
  { key: "30d", label: "30 jours" },
  { key: "90d", label: "90 jours" },
  { key: "365d", label: "1 an" },
] as const;

export function StatsClient() {
  const [range, setRange] = useState<"30d" | "90d" | "365d">("30d");
  const [series, setSeries] = useState<DayStat[]>([]);
  const [heatmap, setHeatmap] = useState<DayStat[]>([]);

  useEffect(() => {
    fetch(`/api/stats?range=${range}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSeries(d.series))
      .catch(() => {});
  }, [range]);

  useEffect(() => {
    fetch(`/api/stats?range=365d`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setHeatmap(d.series))
      .catch(() => {});
  }, []);

  const chartData = useMemo(() => {
    // Remplit les jours creux pour des courbes continues.
    const byDay = new Map(series.map((s) => [s.day, s]));
    const days = range === "365d" ? 365 : range === "90d" ? 90 : 30;
    const out: Record<string, string | number>[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const stat = byDay.get(d);
      const row: Record<string, string | number> = {
        day: d.slice(5),
        total: stat?.total ?? 0,
      };
      for (const attr of ATTRIBUTE_LIST) {
        row[attr.code] = stat?.byAttribute[attr.code] ?? 0;
      }
      out.push(row);
    }
    return out;
  }, [series, range]);

  const heatmapWeeks = useMemo(() => {
    const byDay = new Map(heatmap.map((s) => [s.day, s.total]));
    const today = new Date();
    // Aligne sur le lundi de la semaine courante, puis remonte 52 semaines.
    const weeks: { day: string; total: number }[][] = [];
    const start = new Date(today);
    start.setDate(start.getDate() - 364 - ((start.getDay() + 6) % 7));
    const cursor = new Date(start);
    let week: { day: string; total: number }[] = [];
    while (cursor <= today) {
      const key = cursor.toISOString().slice(0, 10);
      week.push({ day: key, total: byDay.get(key) ?? 0 });
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (week.length > 0) weeks.push(week);
    return weeks;
  }, [heatmap]);

  const max = Math.max(1, ...heatmapWeeks.flat().map((d) => d.total));

  function cellColor(total: number): string {
    if (total === 0) return "var(--surface-raised)";
    const t = Math.min(1, total / max);
    const alpha = 0.25 + t * 0.75;
    return `rgba(124, 92, 255, ${alpha})`;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Heatmap annuelle */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Année d'activité
        </h2>
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-[3px]" style={{ minWidth: 700 }}>
            {heatmapWeeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((d) => (
                  <div
                    key={d.day}
                    title={`${d.day} — ${d.total} XP`}
                    className="h-[11px] w-[11px] rounded-[2px]"
                    style={{ backgroundColor: cellColor(d.total) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Courbes par attribut */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            XP par attribut
          </h2>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs transition-colors",
                  range === r.key
                    ? "bg-accent text-white"
                    : "text-muted hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ width: "100%", height: 320 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData}>
              <CartesianGrid stroke="#232a3b" strokeDasharray="3 3" />
              <XAxis
                dataKey="day"
                tick={{ fill: "#8b93a7", fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis tick={{ fill: "#8b93a7", fontSize: 11 }} width={40} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1b2130",
                  border: "1px solid #232a3b",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              {ATTRIBUTE_LIST.map((attr) => (
                <Area
                  key={attr.code}
                  type="monotone"
                  dataKey={attr.code}
                  stackId="xp"
                  stroke={attr.color}
                  fill={attr.color}
                  fillOpacity={0.35}
                  strokeWidth={1.5}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
