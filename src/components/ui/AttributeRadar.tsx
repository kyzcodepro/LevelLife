"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { ATTRIBUTE_LIST, type AttributeCode } from "@/lib/attributes";

interface AttributeRadarProps {
  /** Niveau par attribut. */
  levels: Partial<Record<AttributeCode, number>>;
  /** Échelle max du radar (par défaut : max des niveaux, min 10). */
  maxLevel?: number;
  /** Hauteur en px (320 par défaut). */
  height?: number;
  className?: string;
}

/**
 * Radar des 8 attributs — le cœur visuel de la fiche de personnage.
 */
export function AttributeRadar({
  levels,
  maxLevel,
  height = 320,
  className,
}: AttributeRadarProps) {
  const data = ATTRIBUTE_LIST.map((attr) => ({
    code: attr.code,
    name: attr.name,
    level: levels[attr.code] ?? 1,
  }));

  const scale =
    maxLevel ?? Math.max(10, ...data.map((d) => d.level));

  return (
    <div className={className} style={{ width: "100%", height }}>
      <ResponsiveContainer>
        <RadarChart data={data} outerRadius="75%">
          <PolarGrid stroke="#232a3b" />
          <PolarAngleAxis
            dataKey="code"
            tick={{ fill: "#8b93a7", fontSize: 12, fontWeight: 600 }}
          />
          <PolarRadiusAxis domain={[0, scale]} tick={false} axisLine={false} />
          <Radar
            dataKey="level"
            stroke="#7C5CFF"
            fill="#7C5CFF"
            fillOpacity={0.25}
            strokeWidth={2}
            isAnimationActive
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
