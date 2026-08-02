"use client";

import { useMemo } from "react";

const COLORS = [
  "#7C5CFF",
  "#F87171",
  "#34D399",
  "#60A5FA",
  "#FB923C",
  "#F472B6",
  "#FACC15",
  "#2DD4BF",
];

/**
 * Burst de confettis en pur CSS (pas de dépendance) — monté au moment de la
 * célébration, il s'anime une fois puis reste inerte (à démonter par le parent).
 */
export function Confetti({ count = 26 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.35;
        const distance = 90 + ((i * 37) % 120);
        return {
          id: i,
          color: COLORS[i % COLORS.length],
          x: `${Math.cos(angle) * distance}px`,
          y: `${Math.sin(angle) * distance - 40}px`,
          r: `${((i * 97) % 360) - 180}deg`,
          delay: `${(i % 5) * 40}ms`,
          size: 5 + ((i * 13) % 6),
        };
      }),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece absolute left-1/2 top-1/2 rounded-[2px]"
          style={
            {
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              animationDelay: p.delay,
              "--cx": p.x,
              "--cy": p.y,
              "--cr": p.r,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
