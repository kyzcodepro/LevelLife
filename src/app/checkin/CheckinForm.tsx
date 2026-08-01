"use client";

/** Ticket 17 — check-in hebdo : 6 curseurs 1-10 + note. */

import { useState } from "react";
import { useRouter } from "next/navigation";

const SLIDERS = [
  { key: "energy", label: "Énergie", low: "Épuisé", high: "En pleine forme" },
  { key: "mood", label: "Humeur", low: "Sombre", high: "Lumineuse" },
  { key: "meaning", label: "Sens", low: "À quoi bon", high: "Aligné" },
  { key: "relations", label: "Relations", low: "Isolé", high: "Entouré" },
  { key: "stress", label: "Stress", low: "Détendu", high: "Sous pression" },
  { key: "satisfaction", label: "Satisfaction", low: "Frustré", high: "Fier" },
] as const;

type SliderKey = (typeof SLIDERS)[number]["key"];

export function CheckinForm() {
  const router = useRouter();
  const [values, setValues] = useState<Record<SliderKey, number>>({
    energy: 5,
    mood: 5,
    meaning: 5,
    relations: 5,
    stress: 5,
    satisfaction: 5,
  });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, note: note || null }),
    });
    if (res.ok) {
      router.push("/retro");
    } else {
      setSaving(false);
      setError("Erreur lors de l'enregistrement du check-in");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {SLIDERS.map((slider) => (
        <div key={slider.key}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-medium">{slider.label}</span>
            <span className="stat-number text-2xl font-bold text-accent">
              {values[slider.key]}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            value={values[slider.key]}
            onChange={(e) =>
              setValues((v) => ({
                ...v,
                [slider.key]: Number(e.target.value),
              }))
            }
            className="w-full accent-[#7C5CFF]"
          />
          <div className="flex justify-between text-xs text-muted">
            <span>{slider.low}</span>
            <span>{slider.high}</span>
          </div>
        </div>
      ))}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Un mot sur ta semaine ? (optionnel, chiffré au repos)"
        rows={3}
        className="w-full rounded-xl border border-border-default bg-surface px-4 py-3 text-sm outline-none focus:border-accent"
      />

      <button
        type="button"
        disabled={saving}
        onClick={submit}
        className="rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40"
      >
        {saving ? "Calcul du LQI…" : "Valider mon check-in"}
      </button>
      {error && <p className="text-sm text-attr-str">{error}</p>}
    </div>
  );
}
