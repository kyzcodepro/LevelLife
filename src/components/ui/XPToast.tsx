"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { AnimatedNumber } from "./AnimatedNumber";

export interface XPToastData {
  id: string | number;
  amount: number;
  attribute: AttributeCode;
}

interface XPToastProps {
  toast: XPToastData | null;
  /** Annulation possible pendant 10 s (critère CDX-1). */
  onUndo?: (id: XPToastData["id"]) => void;
}

/**
 * Toast d'XP : « +42 XP · Force » — spring, halo à la couleur de l'attribut,
 * compteur qui grimpe. Doit apparaître sous 300 ms après un log.
 */
export function XPToast({ toast, onUndo }: XPToastProps) {
  const color = toast ? ATTRIBUTES[toast.attribute].color : "#7C5CFF";
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 32, scale: 0.7 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 22 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full border bg-surface-raised px-5 py-2.5"
            style={{
              borderColor: `${color}66`,
              boxShadow: `0 0 24px ${color}33, 0 8px 24px rgba(0,0,0,0.5)`,
            }}
          >
            <motion.span
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="stat-number flex items-baseline text-lg font-bold"
              style={{ color }}
            >
              +<AnimatedNumber value={toast.amount} duration={0.6} />
              <span className="ml-1">XP</span>
            </motion.span>
            <span className="text-sm font-semibold text-muted">
              · {ATTRIBUTES[toast.attribute].name}
            </span>
            {onUndo && (
              <button
                type="button"
                onClick={() => onUndo(toast.id)}
                className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
              >
                Annuler
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
