"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";

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
 * Toast d'XP : « +42 XP · FOR » — doit apparaître sous 300 ms après un log.
 */
export function XPToast({ toast, onUndo }: XPToastProps) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2"
    >
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-border-default bg-surface-raised px-5 py-2.5 shadow-lg shadow-black/40"
          >
            <span
              className="stat-number text-lg font-bold"
              style={{ color: ATTRIBUTES[toast.attribute].color }}
            >
              +{toast.amount} XP
            </span>
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
