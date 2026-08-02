"use client";

import { motion } from "framer-motion";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { cn } from "@/lib/utils";

interface StatBarProps {
  attribute: AttributeCode;
  level: number;
  /** Progression 0..1 dans le niveau courant. */
  progress: number;
  xpIntoLevel?: number;
  xpForNextLevel?: number;
  className?: string;
}

/**
 * Barre d'attribut de la fiche de personnage : code, niveau, barre d'XP animée.
 */
export function StatBar({
  attribute,
  level,
  progress,
  xpIntoLevel,
  xpForNextLevel,
  className,
}: StatBarProps) {
  const def = ATTRIBUTES[attribute];
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className="stat-number w-12 shrink-0 text-sm font-bold"
        style={{ color: def.color }}
      >
        {def.code}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="truncate text-xs text-muted">{def.name}</span>
          {xpIntoLevel !== undefined && xpForNextLevel !== undefined && (
            <span className="stat-number text-xs text-muted">
              {xpIntoLevel}/{xpForNextLevel} XP
            </span>
          )}
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-raised"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${def.name} niveau ${level}, ${pct} %`}
        >
          <motion.div
            className="xp-shimmer relative h-full overflow-hidden rounded-full"
            style={{
              backgroundColor: def.color,
              boxShadow: `0 0 8px ${def.color}66`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 18 }}
          />
        </div>
      </div>
      <motion.span
        key={level}
        initial={{ scale: 1.6, color: def.color }}
        animate={{ scale: 1, color: "#e7eaf2" }}
        transition={{ type: "spring", stiffness: 300, damping: 15 }}
        className="stat-number w-10 shrink-0 text-right text-lg font-bold"
      >
        {level}
      </motion.span>
    </div>
  );
}
