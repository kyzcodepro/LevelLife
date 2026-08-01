/**
 * Dates locales par fuseau utilisateur (plafond journalier, streaks, semaines).
 */

/** Date locale YYYY-MM-DD d'un instant dans un fuseau donné. */
export function localDateStr(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Décale une date-chaîne YYYY-MM-DD de `days` jours (calendaire, sans TZ). */
export function shiftDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Lundi de la semaine (ISO) contenant la date locale donnée. */
export function weekStartStr(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0 = dimanche
  const delta = dow === 0 ? -6 : 1 - dow;
  return shiftDateStr(dateStr, delta);
}
