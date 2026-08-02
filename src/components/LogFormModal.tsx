"use client";

/**
 * Ticket 10 — formulaire de log détaillé, version intuitive :
 * tous les types visibles, groupés par attribut, filtres par attribut,
 * recherche sur libellé + code + nom d'attribut (« vit » trouve la Vitalité).
 */

import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ImagePlus, X } from "lucide-react";
import {
  ATTRIBUTE_LIST,
  ATTRIBUTES,
  type AttributeCode,
} from "@/lib/attributes";
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function LogFormModal({
  open,
  types,
  onClose,
  onCreated,
}: LogFormModalProps) {
  const [search, setSearch] = useState("");
  const [attrFilter, setAttrFilter] = useState<AttributeCode | null>(null);
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

  /** Groupes par attribut, filtrés par recherche + chip. */
  const groups = useMemo(() => {
    const q = normalize(search);
    const matches = (t: ActivityTypeOption) => {
      if (attrFilter && t.attributeCode !== attrFilter) return false;
      if (!q) return true;
      const attr = ATTRIBUTES[t.attributeCode as AttributeCode];
      return (
        normalize(t.label).includes(q) ||
        normalize(t.code).includes(q) ||
        normalize(attr?.code ?? "").includes(q) ||
        normalize(attr?.name ?? "").includes(q)
      );
    };
    return ATTRIBUTE_LIST.map((attr) => ({
      attr,
      types: types.filter(
        (t) => t.attributeCode === attr.code && matches(t),
      ),
    })).filter((g) => g.types.length > 0);
  }, [types, search, attrFilter]);

  const selected = types.find((t) => t.id === typeId) ?? null;
  const selectedAttr = selected
    ? ATTRIBUTES[selected.attributeCode as AttributeCode]
    : null;

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
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl border border-border-default bg-surface sm:rounded-2xl"
          >
            <div className="flex items-center justify-between px-6 pb-3 pt-6">
              <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold">
                {selected ? "Détails du log" : "Quelle activité ?"}
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
              <div className="flex min-h-0 flex-col px-6 pb-6">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Chercher… (« lecture », « vit », « sommeil »)"
                  autoFocus
                  className="mb-3 w-full rounded-xl border border-border-default bg-surface-raised px-4 py-2.5 outline-none focus:border-accent"
                />
                {/* Filtres par attribut */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {ATTRIBUTE_LIST.map((attr) => (
                    <button
                      key={attr.code}
                      type="button"
                      onClick={() =>
                        setAttrFilter(
                          attrFilter === attr.code ? null : attr.code,
                        )
                      }
                      title={attr.name}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-bold transition-all",
                        attrFilter === attr.code
                          ? "scale-105 text-background"
                          : "bg-surface-raised text-muted hover:text-foreground",
                      )}
                      style={
                        attrFilter === attr.code
                          ? { backgroundColor: attr.color }
                          : {}
                      }
                    >
                      {attr.code}
                    </button>
                  ))}
                </div>
                {/* Liste complète groupée, scrollable */}
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  {groups.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted">
                      Rien ne correspond à « {search} ».
                    </p>
                  ) : (
                    groups.map((group) => (
                      <div key={group.attr.code} className="mb-4">
                        <p
                          className="stat-number sticky top-0 z-10 bg-surface py-1 text-xs font-bold uppercase tracking-wider"
                          style={{ color: group.attr.color }}
                        >
                          {group.attr.name}
                          <span className="ml-2 font-normal normal-case text-muted">
                            {group.attr.domain}
                          </span>
                        </p>
                        <div className="mt-1.5 grid grid-cols-2 gap-2">
                          {group.types.map((t) => (
                            <motion.button
                              key={t.id}
                              type="button"
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setTypeId(t.id)}
                              className="rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-left text-sm transition-colors hover:border-accent"
                            >
                              <span className="block truncate">{t.label}</span>
                              <span className="text-[11px] text-muted">
                                ~{t.baseXp} XP
                              </span>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-6">
                <button
                  type="button"
                  onClick={() => setTypeId(null)}
                  className="flex items-center justify-between rounded-xl border px-4 py-3 text-left"
                  style={{
                    borderColor: selectedAttr?.color,
                    backgroundColor: `${selectedAttr?.color}1a`,
                  }}
                >
                  <span>
                    <span
                      className="stat-number block text-[10px] font-bold"
                      style={{ color: selectedAttr?.color }}
                    >
                      {selectedAttr?.name}
                    </span>
                    <span className="font-medium">{selected.label}</span>
                  </span>
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
                      <motion.button
                        key={emoji}
                        type="button"
                        whileTap={{ scale: 1.4 }}
                        onClick={() => setMood(i + 1)}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xl transition-transform",
                          mood === i + 1
                            ? "scale-125 bg-accent-soft"
                            : "opacity-50 hover:opacity-100",
                        )}
                      >
                        {emoji}
                      </motion.button>
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

                <motion.button
                  type="button"
                  disabled={saving}
                  whileTap={{ scale: 0.97 }}
                  onClick={submit}
                  className="rounded-xl px-4 py-3 font-semibold text-white disabled:opacity-40"
                  style={{
                    backgroundColor: selectedAttr?.color ?? "#7C5CFF",
                    boxShadow: `0 4px 20px ${selectedAttr?.color ?? "#7C5CFF"}44`,
                  }}
                >
                  {saving
                    ? "Enregistrement…"
                    : `Logger (~${selected.baseXp} XP)`}
                </motion.button>
              </div>
            )}
            {error && (
              <p className="px-6 pb-4 text-sm text-attr-str">{error}</p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
