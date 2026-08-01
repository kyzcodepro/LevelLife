"use client";

/**
 * Ticket 10 — formulaire de log détaillé : type, durée, intensité, qualité,
 * humeur, note, tags, photo (upload local en dev, S3/R2 en prod).
 */

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, X } from "lucide-react";
import { ATTRIBUTES, type AttributeCode } from "@/lib/attributes";
import { cn } from "@/lib/utils";

export interface ActivityTypeOption {
  id: string;
  code: string;
  label: string;
  attributeCode: string;
  baseXp: number;
}

interface LogFormModalProps {
  open: boolean;
  types: ActivityTypeOption[];
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onCreated: (data: any) => void;
}

const MOODS = ["😞", "😕", "😐", "🙂", "🤩"];

export function LogFormModal({
  open,
  types,
  onClose,
  onCreated,
}: LogFormModalProps) {
  const [search, setSearch] = useState("");
  const [typeId, setTypeId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | "">("");
  const [intensity, setIntensity] = useState(1);
  const [quality, setQuality] = useState(1);
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return types.filter((t) => t.label.toLowerCase().includes(q)).slice(0, 12);
  }, [types, search]);

  const selected = types.find((t) => t.id === typeId) ?? null;

  async function uploadPhoto(file: File) {
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/uploads", { method: "POST", body: form });
    setUploading(false);
    if (res.ok) {
      const data = await res.json();
      setMediaUrl(data.url);
    } else {
      setError("Upload impossible");
    }
  }

  async function submit() {
    if (!typeId) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityTypeId: typeId,
        durationMin: duration === "" ? null : duration,
        intensity,
        quality,
        mood: mood ?? null,
        note: note || null,
        tags: tags
          ? tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : null,
        mediaUrls: mediaUrl ? [mediaUrl] : null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setTypeId(null);
      setNote("");
      setTags("");
      setMediaUrl(null);
      setMood(null);
      setDuration("");
      onCreated(await res.json());
    } else {
      setError("Erreur lors de la création du log");
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border-default bg-surface p-6 sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold">
                Log détaillé
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="rounded-lg p-1 text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            {/* Choix du type */}
            {!selected ? (
              <div>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Chercher une activité…"
                  className="mb-3 w-full rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 outline-none focus:border-accent"
                />
                <div className="grid grid-cols-2 gap-2">
                  {filtered.map((t) => {
                    const attr = ATTRIBUTES[t.attributeCode as AttributeCode];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTypeId(t.id)}
                        className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-left text-sm transition-colors hover:border-accent"
                      >
                        <span
                          className="stat-number block text-[10px] font-bold"
                          style={{ color: attr?.color }}
                        >
                          {t.attributeCode}
                        </span>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <button
                  type="button"
                  onClick={() => setTypeId(null)}
                  className="flex items-center justify-between rounded-xl border border-accent bg-accent-soft px-4 py-3 text-left"
                >
                  <span className="font-medium">{selected.label}</span>
                  <span className="text-xs text-muted">changer</span>
                </button>

                <label className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted">Durée (min)</span>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={duration}
                    onChange={(e) =>
                      setDuration(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    className="w-24 rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 outline-none focus:border-accent"
                  />
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted">Intensité</span>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={intensity}
                    onChange={(e) => setIntensity(Number(e.target.value))}
                    className="flex-1 accent-[#7C5CFF]"
                  />
                  <span className="stat-number w-10 text-right">
                    ×{intensity.toFixed(1)}
                  </span>
                </label>

                <label className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted">Qualité</span>
                  <input
                    type="range"
                    min={0.8}
                    max={1.3}
                    step={0.05}
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                    className="flex-1 accent-[#7C5CFF]"
                  />
                  <span className="stat-number w-10 text-right">
                    ×{quality.toFixed(2)}
                  </span>
                </label>

                <div className="flex items-center gap-3 text-sm">
                  <span className="w-24 text-muted">Humeur</span>
                  <div className="flex gap-1">
                    {MOODS.map((emoji, i) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setMood(i + 1)}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xl transition-transform",
                          mood === i + 1
                            ? "scale-125 bg-accent-soft"
                            : "opacity-50 hover:opacity-100",
                        )}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Note (optionnel)"
                  rows={2}
                  className="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 text-sm outline-none focus:border-accent"
                />

                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="Tags séparés par des virgules"
                  className="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 text-sm outline-none focus:border-accent"
                />

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-2 rounded-xl border border-border-default px-4 py-2 text-sm text-muted transition-colors hover:text-foreground"
                  >
                    <ImagePlus size={16} />
                    {uploading
                      ? "Envoi…"
                      : mediaUrl
                        ? "Photo ajoutée ✓"
                        : "Ajouter une photo"}
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPhoto(f);
                    }}
                  />
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={submit}
                  className="rounded-xl bg-accent px-4 py-3 font-semibold text-white disabled:opacity-40"
                >
                  {saving ? "Enregistrement…" : "Logger"}
                </button>
              </div>
            )}
            {error && <p className="mt-3 text-sm text-attr-str">{error}</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
