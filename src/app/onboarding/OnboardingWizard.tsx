"use client";

/**
 * Ticket 5 — Onboarding 4 écrans :
 * 1. pseudo → 2. pondération des 8 attributs → 3. trois activités favorites
 * → 4. premier log (déclenche le vrai moteur XP).
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ATTRIBUTE_LIST,
  ATTRIBUTES,
  type AttributeCode,
} from "@/lib/attributes";
import { XPToast, type XPToastData } from "@/components/ui/XPToast";
import { cn } from "@/lib/utils";

interface SystemType {
  id: string;
  code: string;
  label: string;
  attributeCode: string;
  baseXp: number;
}

interface OnboardingWizardProps {
  initialUsername: string;
  systemTypes: SystemType[];
}

const STEPS = ["Pseudo", "Priorités", "Favoris", "Premier log"] as const;

export function OnboardingWizard({
  initialUsername,
  systemTypes,
}: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState(initialUsername);
  const [weights, setWeights] = useState<Record<AttributeCode, number>>(
    Object.fromEntries(ATTRIBUTE_LIST.map((a) => [a.code, 10])) as Record<
      AttributeCode,
      number
    >,
  );
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<XPToastData | null>(null);

  const weightSum = useMemo(
    () => ATTRIBUTE_LIST.reduce((s, a) => s + weights[a.code], 0),
    [weights],
  );

  const favoriteTypes = useMemo(
    () => systemTypes.filter((t) => favorites.includes(t.id)),
    [systemTypes, favorites],
  );

  async function saveProfile(): Promise<boolean> {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, weights, favoriteTypeIds: favorites }),
    });
    setSaving(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "Erreur lors de l'enregistrement");
      return false;
    }
    return true;
  }

  async function firstLog(type: SystemType) {
    setSaving(true);
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityTypeId: type.id }),
    });
    if (res.ok) {
      const data = await res.json();
      const award = data.awards?.[0];
      if (award) {
        setToast({
          id: Date.now(),
          amount: award.amount,
          attribute: award.attributeCode,
        });
      }
      setTimeout(() => {
        window.location.href = "/";
      }, 1200);
    } else {
      setSaving(false);
      setError("Impossible de créer le log");
    }
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) =>
      prev.includes(id)
        ? prev.filter((f) => f !== id)
        : prev.length < 3
          ? [...prev, id]
          : prev,
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4 py-10">
      {/* Barre d'étapes */}
      <div className="mb-10 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                i <= step ? "bg-accent" : "bg-surface-raised",
              )}
            />
            <span
              className={cn(
                "text-xs",
                i === step ? "text-foreground" : "text-muted",
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25 }}
        className="flex-1"
      >
        {step === 0 && (
          <section>
            <h1 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
              Choisis ton pseudo
            </h1>
            <p className="mb-8 text-muted">
              C'est le nom de ton personnage. Tu pourras le rendre public — ou
              pas.
            </p>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. minh_grinder"
              autoFocus
              className="w-full rounded-xl border border-border-default bg-surface px-4 py-3 text-lg outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={!/^[a-zA-Z0-9_-]{2,24}$/.test(username)}
              onClick={() => setStep(1)}
              className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              Continuer
            </button>
          </section>
        )}

        {step === 1 && (
          <section>
            <h1 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
              Qu'est-ce qui compte pour toi ?
            </h1>
            <p className="mb-8 text-muted">
              Répartis l'importance de chaque domaine. Ça pondère ton niveau
              global — tu pourras changer plus tard.
            </p>
            <div className="flex flex-col gap-4">
              {ATTRIBUTE_LIST.map((attr) => (
                <div key={attr.code} className="flex items-center gap-4">
                  <span
                    className="stat-number w-12 text-sm font-bold"
                    style={{ color: attr.color }}
                  >
                    {attr.code}
                  </span>
                  <span className="w-24 truncate text-sm">{attr.name}</span>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={weights[attr.code]}
                    onChange={(e) =>
                      setWeights((w) => ({
                        ...w,
                        [attr.code]: Number(e.target.value),
                      }))
                    }
                    className="flex-1 accent-[#7C5CFF]"
                  />
                  <span className="stat-number w-12 text-right text-sm text-muted">
                    {weightSum > 0
                      ? Math.round((weights[attr.code] / weightSum) * 100)
                      : 0}
                    %
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              disabled={weightSum === 0}
              onClick={() => setStep(2)}
              className="mt-8 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              Continuer
            </button>
          </section>
        )}

        {step === 2 && (
          <section>
            <h1 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
              Tes 3 activités de départ
            </h1>
            <p className="mb-6 text-muted">
              Elles deviennent des habitudes suivies (streaks). Choisis-en
              exactement 3 — {3 - favorites.length} restante(s).
            </p>
            <div className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {systemTypes.map((type) => {
                const selected = favorites.includes(type.id);
                const attr = ATTRIBUTES[type.attributeCode as AttributeCode];
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => toggleFavorite(type.id)}
                    className={cn(
                      "rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? "border-accent bg-accent-soft"
                        : "border-border-default bg-surface hover:bg-surface-raised",
                    )}
                  >
                    <span
                      className="stat-number block text-[10px] font-bold"
                      style={{ color: attr?.color }}
                    >
                      {type.attributeCode}
                    </span>
                    <span className="mt-0.5 block truncate">{type.label}</span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={favorites.length !== 3 || saving}
              onClick={async () => {
                if (await saveProfile()) setStep(3);
              }}
              className="mt-6 w-full rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Enregistrement…" : "Continuer"}
            </button>
          </section>
        )}

        {step === 3 && (
          <section>
            <h1 className="mb-2 font-[family-name:var(--font-space-grotesk)] text-3xl font-bold">
              Ton premier log
            </h1>
            <p className="mb-8 text-muted">
              Qu'as-tu déjà fait aujourd'hui ? Un tap suffit — l'XP tombe tout
              de suite.
            </p>
            <div className="flex flex-col gap-3">
              {favoriteTypes.map((type) => {
                const attr = ATTRIBUTES[type.attributeCode as AttributeCode];
                return (
                  <button
                    key={type.id}
                    type="button"
                    disabled={saving}
                    onClick={() => firstLog(type)}
                    className="flex items-center justify-between rounded-xl border border-border-default bg-surface px-5 py-4 text-left transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-40"
                  >
                    <div>
                      <span
                        className="stat-number block text-xs font-bold"
                        style={{ color: attr?.color }}
                      >
                        {attr?.name}
                      </span>
                      <span className="text-lg font-medium">{type.label}</span>
                    </div>
                    <span className="stat-number text-muted">
                      ~{type.baseXp} XP
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}
      </motion.div>

      {error && <p className="mt-4 text-sm text-attr-str">{error}</p>}
      <XPToast toast={toast} />
    </main>
  );
}
