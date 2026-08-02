"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { Confetti } from "./Confetti";

interface LevelUpModalProps {
  open: boolean;
  attribute: AttributeCode;
  newLevel: number;
  onClose: () => void;
}

/**
 * Level-up plein écran : rayons tournants, confettis, chiffre qui claque.
 * < 2 s, skippable au clic ou à Échap (PRD §8).
 */
export function LevelUpModal({
  open,
  attribute,
  newLevel,
  onClose,
}: LevelUpModalProps) {
  const def = ATTRIBUTES[attribute];

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(onClose, 1900);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={`Niveau ${newLevel} atteint en ${def.name}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-background/90 backdrop-blur-sm"
        >
          {/* Rayons tournants */}
          <div
            className="rays-spin pointer-events-none absolute h-[140vmax] w-[140vmax]"
            style={{
              background: `repeating-conic-gradient(from 0deg, ${def.color}14 0deg 12deg, transparent 12deg 24deg)`,
            }}
          />
          {/* Halo */}
          <motion.div
            className="pointer-events-none absolute h-96 w-96 rounded-full"
            style={{
              background: `radial-gradient(circle, ${def.color}40 0%, transparent 65%)`,
            }}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1.6, opacity: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
          />

          <motion.div
            initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 1.15, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 16 }}
            className="relative flex flex-col items-center gap-2 text-center"
          >
            <Confetti count={30} />
            <motion.span
              initial={{ letterSpacing: "0.6em", opacity: 0 }}
              animate={{ letterSpacing: "0.3em", opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="text-sm font-semibold uppercase"
              style={{ color: def.color }}
            >
              Level up
            </motion.span>
            <motion.span
              className="stat-number text-9xl font-bold leading-none"
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ delay: 0.35, duration: 0.5 }}
              style={{ textShadow: `0 0 48px ${def.color}88` }}
            >
              {newLevel}
            </motion.span>
            <span className="text-lg text-muted">
              {def.name} atteint le niveau {newLevel}
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
