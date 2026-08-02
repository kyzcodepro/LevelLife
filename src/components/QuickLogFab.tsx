"use client";

/**
 * Ticket 9 — Quick Log : FAB accessible partout, grille des 8 types les plus
 * utilisés (30 j), création optimiste, undo 10 s, level-up plein écran.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, SlidersHorizontal } from "lucide-react";
import {
  ATTRIBUTES,
  type AttributeCode,
} from "@/lib/attributes";
import {
  AchievementToast,
  type UnlockedAchievement,
} from "@/components/ui/AchievementToast";
import { newlyUnlocked } from "@/lib/unlocks";
import { LevelUpModal } from "@/components/ui/LevelUpModal";
import { XPToast, type XPToastData } from "@/components/ui/XPToast";
import { LogFormModal, type ActivityTypeOption } from "./LogFormModal";

interface FrequentType {
  id: string;
  code: string;
  label: string;
  attributeCode: string;
  baseXp: number;
}

export function QuickLogFab() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [types, setTypes] = useState<FrequentType[]>([]);
  const [allTypes, setAllTypes] = useState<ActivityTypeOption[]>([]);
  const [toast, setToast] = useState<(XPToastData & { logId?: string }) | null>(
    null,
  );
  const [levelUp, setLevelUp] = useState<{
    attribute: AttributeCode;
    newLevel: number;
  } | null>(null);
  const [questDone, setQuestDone] = useState<string | null>(null);
  const [achievement, setAchievement] = useState<UnlockedAchievement | null>(
    null,
  );
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const achievementQueue = useRef<UnlockedAchievement[]>([]);

  /** File d'attente : les succès débloqués défilent un par un. */
  const showNextAchievement = useCallback(() => {
    const next = achievementQueue.current.shift() ?? null;
    setAchievement(next);
    if (next) setTimeout(showNextAchievement, 3200);
  }, []);

  useEffect(() => {
    fetch("/api/activity-types?frequent=8")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTypes(d.items))
      .catch(() => {});
    fetch("/api/activity-types")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAllTypes(d.items))
      .catch(() => {});
  }, []);

  const showResult = useCallback(
    (data: {
      log: { id: string };
      awards: { attributeCode: AttributeCode; amount: number }[];
      levelUps: { attributeCode: AttributeCode; newLevel: number }[];
      completedQuests: { title: string }[];
      unlocked?: UnlockedAchievement[];
      logsTotal?: number;
    }) => {
      const award = data.awards[0];
      if (award) {
        setToast({
          id: Date.now(),
          amount: data.awards.reduce((s, a) => s + a.amount, 0),
          attribute: award.attributeCode,
          logId: data.log.id,
        });
        if (toastTimer.current) clearTimeout(toastTimer.current);
        // Annulation possible pendant 10 s (critère CDX-1).
        toastTimer.current = setTimeout(() => setToast(null), 10000);
      }
      if (data.levelUps.length > 0) {
        setLevelUp({
          attribute: data.levelUps[0].attributeCode,
          newLevel: data.levelUps[0].newLevel,
        });
      }
      if (data.completedQuests.length > 0) {
        setQuestDone(`⚔️ Quête accomplie : ${data.completedQuests[0].title}`);
        setTimeout(() => setQuestDone(null), 5000);
      }
      if (data.unlocked && data.unlocked.length > 0) {
        achievementQueue.current.push(...data.unlocked);
        // Laisse le level-up passer d'abord.
        setTimeout(showNextAchievement, data.levelUps.length > 0 ? 2200 : 600);
      }
      // Déverrouillage progressif : module franchi → célébration.
      if (typeof data.logsTotal === "number") {
        const modules = newlyUnlocked(data.logsTotal - 1, data.logsTotal);
        if (modules.length > 0) {
          setQuestDone(`Module débloqué : ${modules[0].label} ! 🔓`);
          setTimeout(() => setQuestDone(null), 5000);
        }
      }
      router.refresh();
    },
    [router, showNextAchievement],
  );

  const quickLog = useCallback(
    async (type: FrequentType) => {
      setOpen(false);
      const res = await fetch("/api/logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activityTypeId: type.id }),
      });
      if (res.ok) showResult(await res.json());
    },
    [showResult],
  );

  const undo = useCallback(
    async (logId?: string) => {
      setToast(null);
      if (!logId) return;
      await fetch(`/api/logs/${logId}`, { method: "DELETE" });
      router.refresh();
    },
    [router],
  );

  return (
    <>
      {/* FAB en zone pouce (mobile-first) */}
      <div className="fixed bottom-6 right-5 z-40 flex flex-col items-end gap-3">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="w-72 rounded-2xl border border-border-default bg-surface-raised p-3 shadow-xl shadow-black/50"
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Quick Log
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setDetailOpen(true);
                  }}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted transition-colors hover:bg-accent-soft hover:text-foreground"
                >
                  <SlidersHorizontal size={12} /> Détails
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {types.map((type, i) => {
                  const attr = ATTRIBUTES[type.attributeCode as AttributeCode];
                  return (
                    <motion.button
                      key={type.id}
                      type="button"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.035, duration: 0.2 }}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => quickLog(type)}
                      className="rounded-xl border border-border-default bg-surface px-3 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft"
                    >
                      <span
                        className="stat-number block text-[10px] font-bold"
                        style={{ color: attr?.color }}
                      >
                        {type.attributeCode}
                      </span>
                      <span className="block truncate text-sm">
                        {type.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <motion.button
          type="button"
          aria-label={open ? "Fermer le Quick Log" : "Ouvrir le Quick Log"}
          onClick={() => setOpen((o) => !o)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          className="pulse-glow flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-lg shadow-accent/30"
        >
          <motion.span
            animate={{ rotate: open ? 135 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Plus size={26} />
          </motion.span>
        </motion.button>
      </div>

      {/* Toast quête complétée */}
      <AnimatePresence>
        {questDone && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full border border-accent bg-surface-raised px-5 py-2 text-sm shadow-lg"
          >
            <strong>{questDone}</strong>
          </motion.div>
        )}
      </AnimatePresence>

      <XPToast toast={toast} onUndo={() => undo(toast?.logId)} />
      <AchievementToast achievement={achievement} />
      <LevelUpModal
        open={levelUp !== null}
        attribute={levelUp?.attribute ?? "STR"}
        newLevel={levelUp?.newLevel ?? 1}
        onClose={() => setLevelUp(null)}
      />
      <LogFormModal
        open={detailOpen}
        types={allTypes}
        onClose={() => setDetailOpen(false)}
        onCreated={(data) => {
          setDetailOpen(false);
          showResult(data);
        }}
      />
    </>
  );
}
