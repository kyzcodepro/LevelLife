/**
 * Déverrouillage progressif des modules (PRD §14, « complexité perçue ») :
 * semaine 1 = logger, le reste se débloque comme une récompense.
 * Seuils volontairement lisibles : un nombre de logs, rien d'autre.
 */

export interface ModuleDef {
  key: string;
  href: string;
  label: string;
  /** Nombre de logs nécessaires pour débloquer. */
  threshold: number;
}

export const PROGRESSIVE_MODULES: ModuleDef[] = [
  { key: "timeline", href: "/timeline", label: "Timeline", threshold: 3 },
  { key: "quests", href: "/quests", label: "Quêtes", threshold: 5 },
  { key: "stats", href: "/stats", label: "Stats", threshold: 10 },
  { key: "retro", href: "/retro", label: "Rétro", threshold: 15 },
  { key: "guilds", href: "/guilds", label: "Guilde", threshold: 20 },
  { key: "arena", href: "/arena", label: "Arène", threshold: 30 },
];

export function isUnlocked(key: string, logsTotal: number): boolean {
  const mod = PROGRESSIVE_MODULES.find((m) => m.key === key);
  if (!mod) return true; // modules non progressifs (fiche, réglages)
  return logsTotal >= mod.threshold;
}

export function unlockedModules(logsTotal: number): ModuleDef[] {
  return PROGRESSIVE_MODULES.filter((m) => logsTotal >= m.threshold);
}

/** Le prochain module à débloquer — le teaser affiché dans la nav. */
export function nextUnlock(
  logsTotal: number,
): { module: ModuleDef; remaining: number } | null {
  const next = PROGRESSIVE_MODULES.find((m) => logsTotal < m.threshold);
  return next
    ? { module: next, remaining: next.threshold - logsTotal }
    : null;
}

/** Modules nouvellement franchis entre deux totaux (pour le toast 🔓). */
export function newlyUnlocked(
  previousTotal: number,
  currentTotal: number,
): ModuleDef[] {
  return PROGRESSIVE_MODULES.filter(
    (m) => previousTotal < m.threshold && currentTotal >= m.threshold,
  );
}
