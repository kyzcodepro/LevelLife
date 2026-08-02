"use client";

import { motion } from "framer-motion";
import { ATTRIBUTE_LIST } from "@/lib/attributes";

/**
 * Fond vivant du login/landing : les 8 attributs flottent en orbes floues.
 * Néon contenu — opacité faible, mouvement lent.
 */
export function AttributeOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {ATTRIBUTE_LIST.map((attr, i) => {
        const left = (i * 137) % 100;
        const top = (i * 61 + 15) % 100;
        const size = 140 + (i % 3) * 80;
        return (
          <motion.div
            key={attr.code}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              background: `radial-gradient(circle, ${attr.color}22 0%, transparent 70%)`,
              filter: "blur(10px)",
            }}
            animate={{
              x: [0, (i % 2 === 0 ? 1 : -1) * (30 + i * 6), 0],
              y: [0, (i % 3 === 0 ? -1 : 1) * (24 + i * 4), 0],
            }}
            transition={{
              duration: 14 + i * 2.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}
