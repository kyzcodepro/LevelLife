"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";

interface LevelUpModalProps {
  open: boolean;
  attribute: AttributeCode;
  newLevel: number;
  onClose: () => void;
}

/**
 * Animation de level-up plein écran — < 1,5 s, skippable (PRD §8).
 * Se ferme au clic, à Échap, ou automatiquement après 1,5 s.
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
    const timer = setTimeout(onClose, 1500);
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
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-background/90 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.1, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="flex flex-col items-center gap-2 text-center"
          >
            <span
              className="text-sm font-semibold uppercase tracking-[0.3em]"
              style={{ color: def.color }}
            >
              Level up
            </span>
            <span className="stat-number text-8xl font-bold leading-none">
              {newLevel}
            </span>
            <span className="text-lg text-muted">
              {def.name} atteint le niveau {newLevel}
            </span>
          </motion.div>
          <motion.div
            className="absolute inset-x-0 top-1/2 -z-10 h-64 -translate-y-1/2"
            style={{
              background: `radial-gradient(ellipse at center, ${def.color}33 0%, transparent 70%)`,
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1.4 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
