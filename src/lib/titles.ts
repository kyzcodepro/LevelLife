/**
 * AVA-1 — Titres de personnage par niveau global. Purement cosmétiques,
 * affichés sur la fiche et le profil public.
 */

export interface LevelTitle {
  minLevel: number;
  title: string;
  color: string;
}

export const LEVEL_TITLES: LevelTitle[] = [
  { minLevel: 1, title: "Novice", color: "#8b93a7" },
  { minLevel: 3, title: "Éveillé", color: "#8b93a7" },
  { minLevel: 5, title: "Apprenti", color: "#34D399" },
  { minLevel: 8, title: "Aventurier", color: "#34D399" },
  { minLevel: 12, title: "Combattant", color: "#60A5FA" },
  { minLevel: 16, title: "Vétéran", color: "#60A5FA" },
  { minLevel: 20, title: "Héros", color: "#C084FC" },
  { minLevel: 25, title: "Champion", color: "#C084FC" },
  { minLevel: 32, title: "Maître", color: "#FB923C" },
  { minLevel: 40, title: "Grand Maître", color: "#FB923C" },
  { minLevel: 50, title: "Légende", color: "#FACC15" },
  { minLevel: 70, title: "Mythe", color: "#FACC15" },
  { minLevel: 90, title: "Ascendant", color: "#7C5CFF" },
];

export function titleForLevel(level: number): LevelTitle {
  let current = LEVEL_TITLES[0];
  for (const t of LEVEL_TITLES) {
    if (level >= t.minLevel) current = t;
  }
  return current;
}

/** Prochain palier de titre (pour le teasing « plus que N niveaux »). */
export function nextTitle(level: number): LevelTitle | null {
  return LEVEL_TITLES.find((t) => t.minLevel > level) ?? null;
}
