import { NextRequest, NextResponse } from "next/server";
import { eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { activityTypes } from "@/db/schema";
import { createLog } from "@/lib/logService";
import { apiUser } from "@/lib/session";

const MAX_ROWS = 500;

/**
 * M6 / CDX-7 — Import CSV de l'historique existant.
 * Colonnes attendues (en-tête obligatoire, séparateur virgule ou point-virgule) :
 *   date,type,duree,intensite,qualite,note
 * `type` = code (str_muscu) ou libellé exact du type d'activité.
 * L'XP est recalculé par le vrai moteur (plafonds et diminishing inclus).
 */
export async function POST(req: NextRequest) {
  const user = await apiUser();
  if (!user) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier manquant" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json({ error: "CSV vide" }, { status: 400 });
  }
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].toLowerCase().split(sep).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  if (col("date") === -1 || col("type") === -1) {
    return NextResponse.json(
      { error: "Colonnes requises : date, type" },
      { status: 400 },
    );
  }

  const types = await db
    .select()
    .from(activityTypes)
    .where(or(isNull(activityTypes.userId), eq(activityTypes.userId, user.id)));
  const byCode = new Map(types.map((t) => [t.code.toLowerCase(), t]));
  const byLabel = new Map(types.map((t) => [t.label.toLowerCase(), t]));

  let imported = 0;
  const errors: string[] = [];

  for (const [index, line] of lines.slice(1, MAX_ROWS + 1).entries()) {
    const cells = line.split(sep).map((c) => c.trim());
    const rowNum = index + 2;
    const dateStr = cells[col("date")];
    const typeStr = (cells[col("type")] ?? "").toLowerCase();
    const type = byCode.get(typeStr) ?? byLabel.get(typeStr);
    const occurredAt = new Date(dateStr);
    if (!type) {
      errors.push(`Ligne ${rowNum} : type inconnu « ${cells[col("type")]} »`);
      continue;
    }
    if (Number.isNaN(occurredAt.getTime())) {
      errors.push(`Ligne ${rowNum} : date invalide « ${dateStr} »`);
      continue;
    }
    const num = (name: string) => {
      const i = col(name);
      if (i === -1 || !cells[i]) return undefined;
      const v = Number(cells[i].replace(",", "."));
      return Number.isNaN(v) ? undefined : v;
    };
    try {
      await createLog(db, user, {
        activityTypeId: type.id,
        occurredAt,
        durationMin: num("duree") ?? null,
        intensity: num("intensite") ?? null,
        quality: num("qualite") ?? null,
        note: col("note") !== -1 ? cells[col("note")] || null : null,
        source: "import",
      });
      imported++;
    } catch {
      errors.push(`Ligne ${rowNum} : échec de création`);
    }
  }

  return NextResponse.json({
    imported,
    skipped: errors.length,
    errors: errors.slice(0, 20),
    truncated: lines.length - 1 > MAX_ROWS,
  });
}
