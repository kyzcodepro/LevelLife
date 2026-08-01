/**
 * Moteur XP d'ASCEND (PRD §5.2 / §5.3).
 *
 * xp = base(activity_type)
 *      × intensity        (0.5 → 2.0)
 *      × quality          (0.8 → 1.3)
 *      × streak_mult      (1.0 → 1.5, plafonné)
 *      × diminishing(n)   (anti-farm)
 *
 * diminishing(n) = 1 / (1 + 0.35 × (n - 1))
 *   où n = nombre de logs du même activity_type dans les dernières 24 h
 *   (le log courant inclus : premier log du jour → n = 1 → aucun malus)
 *
 * Plafond d'XP journalier par attribut : 120 + 15 × niveau_attribut.
 *
 * Courbe de niveaux : xp_requis(n) = round(100 × n^1.5) pour passer
 * du niveau n au niveau n+1 (1→2 : 100 XP, 9→10 : 2 700 XP).
 */

export const INTENSITY_MIN = 0.5;
export const INTENSITY_MAX = 2.0;
export const QUALITY_MIN = 0.8;
export const QUALITY_MAX = 1.3;
export const STREAK_MULT_MAX = 1.5;
export const STREAK_MULT_STEP = 0.05;
export const DIMINISHING_RATE = 0.35;
export const DAILY_CAP_BASE = 120;
export const DAILY_CAP_PER_LEVEL = 15;
export const MAX_LEVEL = 99;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Malus anti-farm : n = rang du log parmi ceux du même type sur 24 h glissantes. */
export function diminishing(n: number): number {
  if (!Number.isFinite(n) || n < 1) n = 1;
  return 1 / (1 + DIMINISHING_RATE * (n - 1));
}

/**
 * Multiplicateur de streak : +5 % par jour de streak au-delà du premier,
 * plafonné à ×1.5 (atteint à 11 jours consécutifs).
 */
export function streakMultiplier(streakDays: number): number {
  if (!Number.isFinite(streakDays) || streakDays < 1) streakDays = 1;
  return Math.min(
    STREAK_MULT_MAX,
    1 + STREAK_MULT_STEP * (Math.floor(streakDays) - 1),
  );
}

/** Plafond d'XP journalier pour un attribut donné. */
export function dailyXpCap(attributeLevel: number): number {
  return DAILY_CAP_BASE + DAILY_CAP_PER_LEVEL * Math.max(0, attributeLevel);
}

export interface XpInput {
  /** XP de base du type d'activité. */
  baseXp: number;
  /** Intensité saisie ou mesurée — clampée sur [0.5, 2.0]. */
  intensity?: number;
  /** Auto-évaluation de qualité — clampée sur [0.8, 1.3]. */
  quality?: number;
  /** Streak courant en jours (≥ 1) sur l'habitude liée, s'il y en a une. */
  streakDays?: number;
  /** Rang de ce log parmi ceux du même type dans les dernières 24 h (≥ 1). */
  logsOfTypeLast24h?: number;
  /** Niveau actuel de l'attribut ciblé (pour le plafond journalier). */
  attributeLevel: number;
  /** XP déjà gagné aujourd'hui sur cet attribut (pour le plafond journalier). */
  xpEarnedTodayForAttribute: number;
}

export interface XpResult {
  /** XP effectivement accordé (entier, après plafond). */
  awarded: number;
  /** XP avant application du plafond journalier (entier). */
  raw: number;
  /** Vrai si le plafond journalier a tronqué le gain. */
  capped: boolean;
  /** Plafond journalier applicable. */
  dailyCap: number;
  /** Détail des multiplicateurs appliqués (stocké dans xp_events.multipliers). */
  multipliers: {
    intensity: number;
    quality: number;
    streak: number;
    diminishing: number;
  };
}

/** Calcule l'XP d'un log. Pur et déterministe : rejouable pour le recalcul idempotent. */
export function computeXp(input: XpInput): XpResult {
  const baseXp = Math.max(0, input.baseXp);
  const intensity = clamp(input.intensity ?? 1, INTENSITY_MIN, INTENSITY_MAX);
  const quality = clamp(input.quality ?? 1, QUALITY_MIN, QUALITY_MAX);
  const streak = streakMultiplier(input.streakDays ?? 1);
  const dim = diminishing(input.logsOfTypeLast24h ?? 1);

  const raw = Math.round(baseXp * intensity * quality * streak * dim);

  const cap = dailyXpCap(input.attributeLevel);
  const remaining = Math.max(0, cap - Math.max(0, input.xpEarnedTodayForAttribute));
  const awarded = Math.min(raw, remaining);

  return {
    awarded,
    raw,
    capped: awarded < raw,
    dailyCap: cap,
    multipliers: { intensity, quality, streak, diminishing: dim },
  };
}

/** XP requis pour passer du niveau n au niveau n+1. */
export function xpRequiredForLevel(level: number): number {
  if (level < 1) return 0;
  return Math.round(100 * Math.pow(level, 1.5));
}

/** XP cumulé nécessaire pour atteindre le niveau `level` depuis le niveau 1. */
export function cumulativeXpForLevel(level: number): number {
  let total = 0;
  for (let n = 1; n < level; n++) total += xpRequiredForLevel(n);
  return total;
}

export interface LevelProgress {
  level: number;
  /** XP accumulé dans le niveau courant. */
  xpIntoLevel: number;
  /** XP requis pour passer au niveau suivant. */
  xpForNextLevel: number;
  /** Progression 0..1 dans le niveau courant. */
  progress: number;
}

/** Déduit le niveau et la progression à partir de l'XP total d'un attribut. */
export function levelFromXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, totalXp);
  let level = 1;
  let spent = 0;
  while (level < MAX_LEVEL) {
    const needed = xpRequiredForLevel(level);
    if (xp - spent < needed) break;
    spent += needed;
    level++;
  }
  const xpForNextLevel = xpRequiredForLevel(level);
  const xpIntoLevel = xp - spent;
  return {
    level,
    xpIntoLevel,
    xpForNextLevel,
    progress: xpForNextLevel > 0 ? Math.min(1, xpIntoLevel / xpForNextLevel) : 1,
  };
}

/**
 * Niveau global = floor(moyenne pondérée des 8 niveaux) — PRD §5.3.
 * `weights` : poids déclarés à l'onboarding (somme ≈ 100, en %).
 */
export function globalLevel(
  levels: Record<string, number>,
  weights: Record<string, number>,
): number {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const code of Object.keys(levels)) {
    const w = weights[code] ?? 0;
    weightedSum += (levels[code] ?? 1) * w;
    weightTotal += w;
  }
  if (weightTotal <= 0) {
    const values = Object.values(levels);
    if (values.length === 0) return 1;
    return Math.floor(values.reduce((a, b) => a + b, 0) / values.length);
  }
  return Math.floor(weightedSum / weightTotal);
}
