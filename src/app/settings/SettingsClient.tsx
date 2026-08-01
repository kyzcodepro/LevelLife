"use client";

/**
 * M7 — Réglages : profil public (privé par défaut, granularité par attribut),
 * import CSV, cadre d'intégrations, export RGPD, suppression en 2 clics.
 */

import { useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Download, Trash2, Upload } from "lucide-react";
import { ATTRIBUTE_LIST, type AttributeCode } from "@/lib/attributes";
import { cn } from "@/lib/utils";

/** M6 — providers d'intégration : cadre prêt, OAuth à brancher (vraies clés). */
const INTEGRATIONS = [
  { name: "Strava", attr: "STR", status: "à venir" },
  { name: "Google Fit / Apple Health", attr: "STR, VIT", status: "à venir" },
  { name: "GitHub", attr: "CRE", status: "à venir" },
  { name: "Todoist", attr: "DIS", status: "à venir" },
  { name: "Oura / Whoop", attr: "VIT, ZEN", status: "à venir" },
];

interface SettingsClientProps {
  username: string;
  initialVisibility: "private" | "public";
  initialPublicAttributes: string[];
}

export function SettingsClient({
  username,
  initialVisibility,
  initialPublicAttributes,
}: SettingsClientProps) {
  const [visibility, setVisibility] = useState(initialVisibility);
  const [publicAttrs, setPublicAttrs] = useState<string[]>(
    initialPublicAttributes,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  function flash(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 5000);
  }

  async function save(
    patch: Partial<{ visibility: string; publicAttributes: string[] }>,
  ) {
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
  }

  async function toggleVisibility() {
    const next = visibility === "public" ? "private" : "public";
    setVisibility(next);
    await save({ visibility: next });
  }

  async function toggleAttr(code: AttributeCode) {
    const next = publicAttrs.includes(code)
      ? publicAttrs.filter((c) => c !== code)
      : [...publicAttrs, code];
    setPublicAttrs(next);
    await save({ publicAttributes: next });
  }

  async function importCsv(file: File) {
    setImporting(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/import/csv", { method: "POST", body: form });
    setImporting(false);
    const body = await res.json().catch(() => null);
    if (!res.ok) return flash(body?.error ?? "Import impossible");
    flash(
      `Import terminé : ${body.imported} logs créés` +
        (body.skipped ? `, ${body.skipped} lignes ignorées` : "") +
        ".",
    );
  }

  async function deleteAccount() {
    await fetch("/api/account/delete", { method: "POST" });
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="flex flex-col gap-6">
      {message && (
        <div className="rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {/* Profil public */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">
          Profil public
        </h2>
        <p className="mb-4 text-xs text-muted">
          Privé par défaut. Le LQI n'est jamais public, quoi qu'il arrive.
        </p>
        <label className="flex cursor-pointer items-center justify-between">
          <span className="text-sm">
            Profil visible sur{" "}
            <code className="rounded bg-surface-raised px-1.5 py-0.5 text-xs">
              /u/{username}
            </code>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={visibility === "public"}
            onClick={toggleVisibility}
            className={cn(
              "h-6 w-11 rounded-full p-0.5 transition-colors",
              visibility === "public" ? "bg-accent" : "bg-surface-raised",
            )}
          >
            <span
              className={cn(
                "block h-5 w-5 rounded-full bg-white transition-transform",
                visibility === "public" && "translate-x-5",
              )}
            />
          </button>
        </label>
        {visibility === "public" && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted">
              Attributs affichés publiquement :
            </p>
            <div className="flex flex-wrap gap-2">
              {ATTRIBUTE_LIST.map((attr) => (
                <button
                  key={attr.code}
                  type="button"
                  onClick={() => toggleAttr(attr.code)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-bold transition-colors",
                    publicAttrs.includes(attr.code)
                      ? "text-background"
                      : "bg-surface-raised text-muted",
                  )}
                  style={
                    publicAttrs.includes(attr.code)
                      ? { backgroundColor: attr.color }
                      : {}
                  }
                >
                  {attr.code}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Import CSV */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">
          Importer mon historique (CSV)
        </h2>
        <p className="mb-4 text-xs text-muted">
          Colonnes : <code>date,type,duree,intensite,qualite,note</code> —
          type = code (<code>str_muscu</code>) ou libellé exact. L'XP est
          recalculé par le moteur (plafonds inclus).
        </p>
        <button
          type="button"
          disabled={importing}
          onClick={() => fileInput.current?.click()}
          className="flex items-center gap-2 rounded-xl border border-border-default px-4 py-2.5 text-sm transition-colors hover:border-accent disabled:opacity-40"
        >
          <Upload size={15} />
          {importing ? "Import en cours…" : "Choisir un fichier CSV"}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) importCsv(f);
            e.target.value = "";
          }}
        />
      </section>

      {/* Intégrations */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted">
          Intégrations automatiques
        </h2>
        <p className="mb-4 text-xs text-muted">
          Le cadre est prêt (tokens chiffrés, sync 6 h) — l'OAuth de chaque
          provider sera branché avec de vraies clés d'API.
        </p>
        <ul className="flex flex-col gap-2">
          {INTEGRATIONS.map((integration) => (
            <li
              key={integration.name}
              className="flex items-center justify-between text-sm"
            >
              <span>
                {integration.name}{" "}
                <span className="text-xs text-muted">
                  → {integration.attr}
                </span>
              </span>
              <span className="rounded-full bg-surface-raised px-2.5 py-0.5 text-xs text-muted">
                {integration.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Données — départ facile (PRD §11.7) */}
      <section className="rounded-2xl border border-border-default bg-surface p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">
          Mes données
        </h2>
        <div className="flex flex-col gap-3">
          <a
            href="/api/export"
            className="flex w-fit items-center gap-2 rounded-xl border border-border-default px-4 py-2.5 text-sm transition-colors hover:border-accent"
          >
            <Download size={15} />
            Exporter toutes mes données (JSON)
          </a>
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-fit items-center gap-2 rounded-xl border border-border-default px-4 py-2.5 text-sm text-muted transition-colors hover:border-attr-str hover:text-attr-str"
            >
              <Trash2 size={15} />
              Supprimer mon compte
            </button>
          ) : (
            <div className="rounded-xl border border-attr-str/50 bg-attr-str/10 p-4">
              <p className="mb-3 text-sm">
                Suppression définitive et immédiate de toutes tes données.
                Pense à exporter avant. Aucune friction, aucune relance —
                promis.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={deleteAccount}
                  className="rounded-xl bg-attr-str px-4 py-2 text-sm font-semibold text-white"
                >
                  Supprimer définitivement
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-xl px-4 py-2 text-sm text-muted"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
