"use client";

import { motion } from "framer-motion";
import { AnimatedNumber } from "./AnimatedNumber";

/**
 * Anneau de niveau global : le chiffre est le héros, l'anneau montre la
 * progression moyenne vers les prochains niveaux d'attributs.
 */
export function LevelRing({
  level,
  progress,
}: {
  level: number;
  /** 0..1 — progression moyenne dans les niveaux courants. */
  progress: number;
}) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--surface-raised)"
          strokeWidth="8"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference * (1 - Math.min(1, progress)),
          }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.2 }}
          style={{ filter: "drop-shadow(0 0 6px rgba(124,92,255,0.6))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <AnimatedNumber
          value={level}
          className="stat-number text-5xl font-bold text-accent"
          duration={1}
        />
        <span className="text-[10px] uppercase tracking-wider text-muted">
          Niveau
        </span>
      </div>
    </div>
  );
}
