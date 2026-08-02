"use client";

/**
 * AVA-2 — L'emblème du personnage (pas de mascotte cartoon, PRD §8) :
 * un sigil géométrique unique dérivé du pseudo, teinté par l'attribut
 * dominant, dont l'aura s'intensifie avec le niveau global.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function polygonPoints(
  cx: number,
  cy: number,
  r: number,
  sides: number,
  rotation = 0,
): string {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 + rotation;
    return `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`;
  }).join(" ");
}

export function Sigil({
  seed,
  color = "#7C5CFF",
  level = 1,
  size = 96,
}: {
  /** Généralement le pseudo — même seed, même emblème, pour toujours. */
  seed: string;
  /** Couleur de l'attribut dominant. */
  color?: string;
  level?: number;
  size?: number;
}) {
  const shape = useMemo(() => {
    const rand = rng(hashString(seed));
    const sides = 5 + Math.floor(rand() * 4); // 5 à 8 côtés
    const innerSides = 3 + Math.floor(rand() * 3);
    const rotation = rand() * Math.PI;
    const innerRotation = rand() * Math.PI;
    // Constellation intérieure : 4-6 points reliés
    const nodes = Array.from({ length: 4 + Math.floor(rand() * 3) }, () => {
      const a = rand() * Math.PI * 2;
      const d = 8 + rand() * 22;
      return { x: 50 + Math.cos(a) * d, y: 50 + Math.sin(a) * d };
    });
    return { sides, innerSides, rotation, innerRotation, nodes };
  }, [seed]);

  // L'aura grandit avec le niveau (paliers de 10).
  const auraStrength = Math.min(1, 0.25 + (level / 40) * 0.75);
  const tier = Math.floor(level / 10); // anneaux bonus tous les 10 niveaux

  return (
    <motion.svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      initial={{ scale: 0.8, opacity: 0, rotate: -12 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      style={{
        filter: `drop-shadow(0 0 ${6 + level}px ${color}${Math.round(
          auraStrength * 160,
        )
          .toString(16)
          .padStart(2, "0")})`,
      }}
    >
      {/* Anneaux de palier (1 par tranche de 10 niveaux) */}
      {Array.from({ length: Math.min(3, tier) }, (_, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={46 - i * 3}
          fill="none"
          stroke={color}
          strokeOpacity={0.25 - i * 0.06}
          strokeWidth="1"
          strokeDasharray={i === 0 ? undefined : "3 4"}
        />
      ))}
      {/* Enveloppe */}
      <polygon
        points={polygonPoints(50, 50, 38, shape.sides, shape.rotation)}
        fill={`${color}14`}
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Forme intérieure, en rotation très lente */}
      <motion.polygon
        points={polygonPoints(50, 50, 22, shape.innerSides, shape.innerRotation)}
        fill="none"
        stroke={color}
        strokeOpacity="0.65"
        strokeWidth="1.5"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "50px 50px" }}
      />
      {/* Constellation unique au pseudo */}
      <polyline
        points={shape.nodes.map((n) => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(" ")}
        fill="none"
        stroke={color}
        strokeOpacity="0.9"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      {shape.nodes.map((n, i) => (
        <circle
          key={i}
          cx={n.x}
          cy={n.y}
          r={i === 0 ? 2.4 : 1.6}
          fill={color}
        />
      ))}
    </motion.svg>
  );
}
