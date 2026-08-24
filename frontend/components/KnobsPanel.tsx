"use client";

import { useState } from "react";
import { updateBook, ApiError, type Book } from "@/lib/api";
import { SaveRow } from "./SettingsUI";

interface KnobPreset {
  value: string;
  label: string;
}

interface KnobDef {
  key: string;
  label: string;
  presets: KnobPreset[];
  color: { bg: string; fg: string };
}

const KNOB_DEFS: KnobDef[] = [
  {
    key: "line_weight",
    label: "Line weight",
    color: { bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
    presets: [
      { value: "thin", label: "Thin" },
      { value: "medium", label: "Medium" },
      { value: "bold", label: "Bold" },
    ],
  },
  {
    key: "detail_density",
    label: "Detail density",
    color: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
    presets: [
      { value: "minimal", label: "Minimal" },
      { value: "moderate", label: "Moderate" },
      { value: "intricate", label: "Intricate" },
    ],
  },
  {
    key: "style_tone",
    label: "Style tone",
    color: { bg: "var(--tone-peach-bg)", fg: "var(--tone-peach)" },
    presets: [
      { value: "playful", label: "Playful" },
      { value: "balanced", label: "Balanced" },
      { value: "elegant", label: "Elegant" },
    ],
  },
  {
    key: "subject_treatment",
    label: "Subject treatment",
    color: { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow)" },
    presets: [
      { value: "personified", label: "Personified" },
      { value: "realistic", label: "Realistic" },
      { value: "neutral", label: "Neutral" },
    ],
  },
  {
    key: "character_mood",
    label: "Character mood",
    color: { bg: "var(--tone-lavender-bg)", fg: "var(--tone-lavender)" },
    presets: [
      { value: "cute", label: "Cute" },
      { value: "aggressive", label: "Aggressive" },
      { value: "calm", label: "Calm" },
      { value: "mysterious", label: "Mysterious" },
      { value: "happy", label: "Happy" },
      { value: "silly", label: "Silly" },
    ],
  },
  {
    key: "background_richness",
    label: "Background richness",
    color: { bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
    presets: [
      { value: "bare", label: "Bare" },
      { value: "light_props", label: "Light props" },
      { value: "full_scene", label: "Full scene" },
    ],
  },
  {
    key: "border_style",
    label: "Border style",
    color: { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
    presets: [
      { value: "none", label: "None" },
      { value: "simple_frame", label: "Simple frame" },
      { value: "decorative", label: "Decorative" },
    ],
  },
];

type KnobValues = Record<string, string>;
type KnobEnabled = Record<string, boolean>;

export default function KnobsPanel({
  bookId,
  book,
  onBookLoaded,
}: {
  bookId: number;
  book: Book;
  onBookLoaded: (book: Book) => void;
}) {
  const initialValues: KnobValues = {};
  const initialEnabled: KnobEnabled = {};
  for (const def of KNOB_DEFS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialValues[def.key] = (book as any)[def.key] ?? def.presets[0].value;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialEnabled[def.key] = (book as any)[`${def.key}_enabled`] ?? true;
  }

  const [values, setValues] = useState<KnobValues>(initialValues);
  const [enabled, setEnabled] = useState<KnobEnabled>(initialEnabled);
  const [customMode, setCustomMode] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function setEnabledFlag(key: string, val: boolean) {
    setEnabled((prev) => ({ ...prev, [key]: val }));
  }

  function isPreset(def: KnobDef, value: string): boolean {
    return def.presets.some((p) => p.value === value);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, string | boolean> = {};
      for (const def of KNOB_DEFS) {
        payload[def.key] = values[def.key];
        payload[`${def.key}_enabled`] = enabled[def.key];
      }
      const updated = await updateBook(bookId, payload);
      onBookLoaded(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save style knobs");
    } finally {
      setSaving(false);
    }
  }

  // Character mood only makes sense when Subject treatment is enabled AND set to "personified".
  const treatmentActive = enabled["subject_treatment"] && values["subject_treatment"] === "personified";

  return (
    <div className="space-y-5">
      {error && (
        <div
          className="px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {KNOB_DEFS.map((def) => {
        if (def.key === "character_mood" && !treatmentActive) return null;

        const knobEnabled = enabled[def.key];
        const usingCustom = customMode[def.key] || !isPreset(def, values[def.key]);

        return (
          <div
            key={def.key}
            className="rounded-md border-[1.5px] p-3"
            style={{ borderColor: "var(--pencil-light)", opacity: knobEnabled ? 1 : 0.5 }}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {def.label}
              </label>
              <label className="flex items-center gap-1.5 text-[10px]" style={{ color: "var(--pencil)" }}>
                <input
                  type="checkbox"
                  checked={knobEnabled}
                  onChange={(e) => setEnabledFlag(def.key, e.target.checked)}
                />
                Enabled
              </label>
            </div>

            {knobEnabled && (
              <>
                <div className="flex gap-2 flex-wrap mb-2">
                  {def.presets.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => {
                      setValue(def.key, p.value);
                      setCustomMode((prev) => ({ ...prev, [def.key]: false }));
                    }}
                    className="px-2.5 py-1 rounded-full text-[11px] border-[1.5px]"
                    style={
                      !usingCustom && values[def.key] === p.value
                        ? { background: def.color.fg, borderColor: def.color.fg, color: "white" }
                        : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                    }
                  >
                    {p.label}
                  </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setCustomMode((prev) => ({ ...prev, [def.key]: true }))}
                    className="px-2.5 py-1 rounded-full text-[11px] border-[1.5px]"
                    style={
                      usingCustom
                        ? { background: def.color.fg, borderColor: def.color.fg, color: "white" }
                        : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                    }
                  >
                    Custom
                  </button>
                </div>
                {usingCustom && (
                  <input
                    type="text"
                    value={values[def.key]}
                    onChange={(e) => setValue(def.key, e.target.value)}
                    placeholder="Describe it yourself..."
                    className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] outline-none text-sm"
                    style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                  />
                )}
              </>
            )}
          </div>
        );
      })}

      <SaveRow onClick={handleSave} saving={saving} saved={saved} label="Save style knobs" />
    </div>
  );
}
