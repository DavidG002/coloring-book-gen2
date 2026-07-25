"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSettings, updateSettings, ApiError, type Settings } from "@/lib/api";

const DEFAULTS: Settings = {
  batch_confirmation_threshold: 15,
  sleep_between_calls: 1.2,
  sleep_on_failure: 5.0,
};

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
          Global settings
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--pencil)" }}>
          Operational settings that apply everywhere, regardless of book. Image size, cleanup, and palette are now
          set per book — visit a book&apos;s page to adjust those.
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
