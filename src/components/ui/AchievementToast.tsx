"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Trophy } from "lucide-react";
import { Confetti } from "./Confetti";

export interface UnlockedAchievement {
  code: string;
  title: string;
  rarity: string;
}

const RARITY_COLOR: Record<string, string> = {
  common: "#8b93a7",
  uncommon: "#34D399",
  rare: "#60A5FA",
  epic: "#C084FC",
  legendary: "#FACC15",
};

const RARITY_LABEL: Record<string, string> = {
  common: "Commun",
  uncommon: "Peu commun",
  rare: "Rare",
  epic: "Épique",
  legendary: "Légendaire",
};

/** Toast « Succès débloqué » — couleur de rareté + confettis. */
export function AchievementToast({
  achievement,
}: {
  achievement: UnlockedAchievement | null;
}) {
  const color = achievement
    ? (RARITY_COLOR[achievement.rarity] ?? "#8b93a7")
    : "#8b93a7";
  return (
    <div className="pointer-events-none fixed left-1/2 top-16 z-50 -translate-x-1/2">
      <AnimatePresence>
        {achievement && (
          <motion.div
            key={achievement.code}
            initial={{ opacity: 0, y: -32, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="relative flex items-center gap-3 rounded-2xl border bg-surface-raised px-5 py-3"
            style={{
              borderColor: `${color}88`,
              boxShadow: `0 0 28px ${color}33, 0 8px 24px rgba(0,0,0,0.5)`,
            }}
          >
            <Confetti count={18} />
            <motion.div
              animate={{ rotate: [0, -12, 12, 0] }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <Trophy size={22} style={{ color }} />
            </motion.div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color }}>
                Succès {RARITY_LABEL[achievement.rarity] ?? ""} débloqué
              </p>
              <p className="font-[family-name:var(--font-space-grotesk)] font-bold">
                {achievement.title}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
