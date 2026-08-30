"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, Globe2, Settings2, ChevronRight, Check, Plus } from "lucide-react";
import { getSettings, updateSettings, ApiError, type Settings } from "@/lib/api";
import BackupSettingsPanel from "@/components/BackupSettingsPanel";
import { AccountSection, Field } from "@/components/SettingsUI";
import AppShell from "@/components/AppShell";
import type { components } from "@/lib/api/generated-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEFAULTS: Settings = {
  batch_confirmation_threshold: 15,
  sleep_between_calls: 1.2,
  sleep_on_failure: 5.0,
};

type SupportedLanguageItem = components["schemas"]["SupportedLanguageRead"];

async function getLanguages(): Promise<SupportedLanguageItem[]> {
  const res = await fetch(`${API_BASE_URL}/account/languages`);
  return res.json();
}
async function addLanguage(code: string, name: string): Promise<SupportedLanguageItem> {
  const res = await fetch(`${API_BASE_URL}/account/languages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to add language");
  }
  return res.json();
}
async function deleteLanguage(code: string): Promise<void> {
  await fetch(`${API_BASE_URL}/account/languages/${code}`, { method: "DELETE" });
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetApplied, setResetApplied] = useState(false);

  const [languages, setLanguages] = useState<SupportedLanguageItem[]>([]);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [languageError, setLanguageError] = useState<string | null>(null);
  const [showAddLang, setShowAddLang] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [settingsData, langData] = await Promise.all([getSettings(), getLanguages()]);
        if (cancelled) return;
        setSettings(settingsData);
        setLanguages(langData);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
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

  async function handleAddLanguage() {
    setLanguageError(null);
    const code = newLangCode.trim().toLowerCase();
    const name = newLangName.trim();
    if (!code || !name) {
      setLanguageError("Both a code (e.g. 'nl') and a name (e.g. 'Dutch') are required.");
      return;
    }
    try {
      const lang = await addLanguage(code, name);
      setLanguages((prev) => [...prev, lang].sort((a, b) => a.name.localeCompare(b.name)));
      setNewLangCode("");
      setNewLangName("");
      setShowAddLang(false);
    } catch (err) {
      setLanguageError(err instanceof Error ? err.message : "Failed to add language");
    }
  }

  async function handleDeleteLanguage(code: string) {
    await deleteLanguage(code);
    setLanguages((prev) => prev.filter((l) => l.code !== code));
  }

  return (
    <AppShell active="Overview" breadcrumb="Settings">
      <div className="grid mx-auto" style={{ maxWidth: 1120, gridTemplateColumns: "minmax(0, 1fr) 270px", gap: 24 }}>
        <div>
          <div className="flex items-end justify-between gap-6 mb-9">
            <div>
              <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
                How the app behaves
              </p>
              <h1
                className="font-display font-normal m-0 mt-2"
                style={{ fontSize: "clamp(32px, 4vw, 44px)", letterSpacing: "-0.045em", color: "var(--ink)" }}
              >
                Settings<span style={{ color: "var(--teal)" }}>.</span>
              </h1>
              <p className="text-[13px] m-0 mt-2" style={{ color: "var(--pencil)", maxWidth: 480 }}>
                Languages, generation pacing, and backups — kept simple and ready when you are.
              </p>
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full shrink-0"
              style={{ padding: "9px 12px", border: "1px solid var(--tone-sage)", background: "var(--tone-sage-bg)", color: "var(--tone-sage)" }}
            >
              <ShieldCheck size={15} />
              <span className="text-[10px] font-bold whitespace-nowrap">Workspace protected</span>
            </div>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-md text-sm" style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}>
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading...</p>
          ) : (
            <div className="grid gap-4">
              <AccountSection
                eyebrow="Translation defaults"
                title="Languages"
                description="Available languages for translations across the app."
                icon={<Globe2 size={16} />}
              >
                {languageError && (
                  <p className="text-sm mb-2" style={{ color: "var(--coral-dark)" }}>{languageError}</p>
                )}
                <div className="flex flex-wrap gap-2 mb-4">
                  {languages.map((lang) => (
                    <div
                      key={lang.code}
                      className="inline-flex items-center gap-2 rounded-full text-xs"
                      style={{ padding: "8px 11px", border: "1px solid var(--tone-sage)", background: "var(--tone-sage-bg)", color: "var(--tone-sage)", fontWeight: 700 }}
                    >
                      {lang.name} <span style={{ opacity: 0.7 }}>({lang.code})</span>
                      <button onClick={() => handleDeleteLanguage(lang.code)} style={{ color: "var(--coral-dark)" }} title="Remove">
                        ×
                      </button>
                    </div>
                  ))}
                  {!showAddLang ? (
                    <button
                      onClick={() => setShowAddLang(true)}
                      className="inline-flex items-center gap-1.5 rounded-full text-xs font-bold"
                      style={{ padding: "8px 11px", border: "1px dashed var(--pencil-light)", color: "var(--pencil)" }}
                    >
                      <Plus size={12} /> Add language
                    </button>
                  ) : null}
                </div>
                {showAddLang && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newLangCode}
                      onChange={(e) => setNewLangCode(e.target.value)}
                      placeholder="Code (e.g. nl)"
                      className="w-28 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                      style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                    />
                    <input
                      type="text"
                      value={newLangName}
                      onChange={(e) => setNewLangName(e.target.value)}
                      placeholder="Name (e.g. Dutch)"
                      className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                      style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                    />
                    <button onClick={handleAddLanguage} className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ background: "var(--teal)" }}>
                      Add
                    </button>
                    <button onClick={() => setShowAddLang(false)} className="px-3 py-2 text-sm" style={{ color: "var(--pencil)" }}>
                      Cancel
                    </button>
                  </div>
                )}
              </AccountSection>

              {settings && (
                <AccountSection
                  eyebrow="Studio rhythm"
                  title="Generation behavior"
                  description="Set the small pauses that keep batch creation predictable."
                  icon={<Settings2 size={16} />}
                >
                  <div className="grid grid-cols-2 gap-5 mb-4">
                    <Field label="Sleep between calls (sec)" hint="Pause after each successful image" value={settings.sleep_between_calls} onChange={(v) => update("sleep_between_calls", v)} step={0.1} min={0} />
                    <Field label="Sleep on failure (sec)" hint="Pause after a failed image before retrying" value={settings.sleep_on_failure} onChange={(v) => update("sleep_on_failure", v)} step={0.5} min={0} />
                    <Field label="Batch confirmation threshold" hint="Not yet enforced in the UI — reserved for a future safety prompt" value={settings.batch_confirmation_threshold} onChange={(v) => update("batch_confirmation_threshold", v)} min={1} />
                  </div>
                  <div className="flex items-center gap-4 mt-5 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
                    <button onClick={handleSave} disabled={saving} className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60" style={{ background: "var(--teal)" }}>
                      {saving ? "Saving..." : "Save settings"}
                    </button>
                    <button onClick={handleResetDefaults} className="px-4 py-2 rounded-md text-sm font-medium" style={{ color: "var(--pencil)" }}>
                      Reset to defaults
                    </button>
                    {saved && <span className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: "var(--teal)" }}><Check size={14} /> Saved</span>}
                    {resetApplied && <span className="text-sm font-medium" style={{ color: "var(--pencil)" }}>Defaults applied — click Save to persist</span>}
                  </div>
                </AccountSection>
              )}

              <BackupSettingsPanel />
            </div>
          )}
        </div>

        <aside>
          <div className="rounded-xl p-5 sticky" style={{ top: 90, border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
            <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
              Quick guide
            </p>
            <h3 className="font-display font-normal m-0 mt-1.5" style={{ fontSize: 18, color: "var(--ink)" }}>
              Make the studio feel like yours.
            </h3>
            <p className="text-xs m-0 mt-2" style={{ color: "var(--pencil)" }}>
              These preferences affect new books and generated pages, not the work you have already published.
            </p>
            <div className="mt-4 pt-4 space-y-2.5" style={{ borderTop: "1px solid var(--pencil-light)" }}>
              <Link href="/" className="flex items-center justify-between text-xs font-bold" style={{ color: "var(--teal)" }}>
                Back to overview <ChevronRight size={13} />
              </Link>
              <Link href="/categories" className="flex items-center justify-between text-xs font-bold" style={{ color: "var(--teal)" }}>
                Browse categories <ChevronRight size={13} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
