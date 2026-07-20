"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSettings, updateSettings, ApiError, type Settings } from "@/lib/api";

const DEFAULTS: Settings = {
  canvas_width: 595,
  canvas_height: 842,
  subject_size_ratio: 0.5,
  white_clean_threshold: 245,
  black_clean_threshold: 10,
  palette_colors: 8,
  batch_confirmation_threshold: 15,
  sleep_between_calls: 1.2,
  sleep_on_failure: 5.0,
};
const PAPER_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "A4 (595 × 842)", width: 595, height: 842 },
  { label: "US Letter (612 × 792)", width: 612, height: 792 },
  { label: "A5 (420 × 595)", width: 420, height: 595 },
  { label: "Square (800 × 800)", width: 800, height: 800 },
];

function Field({
  label,
  hint,
  value,
  onChange,
  step,
  min,
  max,
}: {
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink)" }}>
        {label}
      </label>
      <p className="text-xs mb-1.5" style={{ color: "var(--pencil)" }}>
        {hint}
      </p>
      <input
        type="number"
        value={value}
        step={step ?? 1}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-40 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
      />
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [resetApplied, setResetApplied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((data) => {
        if (!cancelled) setSettings(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof Settings>(key: K, value: number) {
    if (!settings) return;
    setResetApplied(false);
    setSettings({ ...settings, [key]: value });
  }


  async function handleSave() {
    if (!settings) return;
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  function handleResetDefaults() {
    setSettings(DEFAULTS);
    setSaved(false);
    setResetApplied(true);
    setTimeout(() => setResetApplied(false), 2500);
  }
  function applyPreset(label: string) {
    const preset = PAPER_PRESETS.find((p) => p.label === label);
    if (!preset || !settings) return;
    setResetApplied(false);
    setSettings({ ...settings, canvas_width: preset.width, canvas_height: preset.height });
  }
  
  if (loading) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-2xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
      </main>
    );
  }

  if (!settings) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-2xl mx-auto">
        <p style={{ color: "var(--coral-dark)" }}>{error ?? "Failed to load settings"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-8 py-12 max-w-2xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() => router.push("/")}
          className="text-sm mb-3 inline-block"
          style={{ color: "var(--pencil)" }}
        >
          {"\u2190"} All categories
        </button>
        <h1 className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
          Advanced settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--pencil)" }}>
          Fine-tuning for image output and generation behavior. These apply to every category.
        </p>
      </header>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="space-y-10">
        <section>
          <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Canvas & sizing
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--pencil)" }}>
            Controls the output page dimensions and how large the subject appears. Changes apply to new generations only.
          </p>

          <div className="mb-5">
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
              Paper size preset
            </label>
            <select
              onChange={(e) => e.target.value && applyPreset(e.target.value)}
              defaultValue=""
              className="w-56 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            >
              <option value="" disabled>
                Choose a preset...
              </option>
              {PAPER_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.label}>
                  {preset.label}
                </option>
              ))}
              <option value="custom" disabled>
                Or edit width/height directly below
              </option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Field
              label="Canvas width (px)"
              hint="A4 default is 595"
              value={settings.canvas_width}
              onChange={(v) => update("canvas_width", v)}
              min={1}
            />
            <Field
              label="Canvas height (px)"
              hint="A4 default is 842"
              value={settings.canvas_height}
              onChange={(v) => update("canvas_height", v)}
              min={1}
            />
            <Field
              label="Subject size ratio"
              hint="Fraction of canvas height the subject fills (0.55-0.70 works well)"
              value={settings.subject_size_ratio}
              onChange={(v) => update("subject_size_ratio", v)}
              step={0.05}
              min={0.1}
              max={1}
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Image cleanup
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--pencil)" }}>
            Controls line smoothing and file size. Rarely needs adjustment.
          </p>
          <div className="grid grid-cols-2 gap-5">
            <Field
              label="White threshold"
              hint="Pixels brighter than this become pure white"
              value={settings.white_clean_threshold}
              onChange={(v) => update("white_clean_threshold", v)}
              min={0}
              max={255}
            />
            <Field
              label="Black threshold"
              hint="Pixels darker than this become pure black"
              value={settings.black_clean_threshold}
              onChange={(v) => update("black_clean_threshold", v)}
              min={0}
              max={255}
            />
            <Field
              label="Palette colors"
              hint="Fewer colors = smaller file size"
              value={settings.palette_colors}
              onChange={(v) => update("palette_colors", v)}
              min={2}
              max={256}
            />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
            Generation behavior
          </h2>
          <p className="text-sm mb-4" style={{ color: "var(--pencil)" }}>
            Pacing between API calls and safety confirmation.
          </p>
          <div className="grid grid-cols-2 gap-5">
            <Field
              label="Sleep between calls (sec)"
              hint="Pause after each successful image"
              value={settings.sleep_between_calls}
              onChange={(v) => update("sleep_between_calls", v)}
              step={0.1}
              min={0}
            />
            <Field
              label="Sleep on failure (sec)"
              hint="Pause after a failed image before retrying"
              value={settings.sleep_on_failure}
              onChange={(v) => update("sleep_on_failure", v)}
              step={0.5}
              min={0}
            />
            <Field
              label="Batch confirmation threshold"
              hint="Not yet enforced in the UI — reserved for a future safety prompt"
              value={settings.batch_confirmation_threshold}
              onChange={(v) => update("batch_confirmation_threshold", v)}
              min={1}
            />
          </div>
        </section>
      </div>

      <div className="flex items-center gap-4 mt-10 pt-6 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
          style={{ background: "var(--teal)" }}
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        <button
          onClick={handleResetDefaults}
          className="px-4 py-2.5 rounded-md text-sm font-medium"
          style={{ color: "var(--pencil)" }}
        >
          Reset to defaults
        </button>
        {saved && (
          <span className="text-sm font-medium" style={{ color: "var(--teal)" }}>
            Saved
          </span>
        )}
        {resetApplied && (
          <span className="text-sm font-medium" style={{ color: "var(--pencil)" }}>
            Defaults applied — click Save to persist
          </span>
        )}
      </div>
    </main>
  );
}
