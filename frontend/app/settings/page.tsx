"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getSettings, updateSettings, ApiError, type Settings } from "@/lib/api";
import BackupSettingsPanel from "@/components/BackupSettingsPanel";
import { Card, SubCard, SaveRow, Field } from "@/components/SettingsUI";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEFAULTS: Settings = {
  batch_confirmation_threshold: 15,
  sleep_between_calls: 1.2,
  sleep_on_failure: 5.0,
};

interface OpenAIKeyRead {
  has_key: boolean;
  masked_key?: string;
}

interface WordPressIntegrationRead {
  site_url?: string;
  username?: string;
  has_password: boolean;
  post_type?: string;
  taxonomy?: string;
  last_test_status?: string;
  last_test_message?: string;
  last_tested_at?: string;
  use_polylang_linking?: boolean;
}

interface SupportedLanguageItem {
  code: string;
  name: string;
}

async function getOpenAIKey(): Promise<OpenAIKeyRead> {
  const res = await fetch(`${API_BASE_URL}/account/openai-key`);
  return res.json();
}

async function updateOpenAIKey(key: string): Promise<OpenAIKeyRead> {
  const res = await fetch(`${API_BASE_URL}/account/openai-key`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ openai_api_key: key }),
  });
  return res.json();
}

async function getWordPressIntegration(): Promise<WordPressIntegrationRead> {
  const res = await fetch(`${API_BASE_URL}/account/wordpress`);
  return res.json();
}

async function updateWordPressIntegration(data: {
  site_url?: string;
  username?: string;
  app_password?: string;
  post_type?: string;
  taxonomy?: string;
  use_polylang_linking?: boolean;
}): Promise<WordPressIntegrationRead> {
  const res = await fetch(`${API_BASE_URL}/account/wordpress`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function testWordPressConnection(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/account/wordpress/test`, { method: "POST" });
  return res.json();
}

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
  const router = useRouter();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resetApplied, setResetApplied] = useState(false);

  const [openaiKey, setOpenaiKey] = useState<OpenAIKeyRead | null>(null);
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [wpHasPassword, setWpHasPassword] = useState(false);
  const [savingWp, setSavingWp] = useState(false);
  const [wpSaved, setWpSaved] = useState(false);
  const [testingWp, setTestingWp] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [wpLastTest, setWpLastTest] = useState<{ status?: string; message?: string; at?: string } | null>(null);
  const [wpPostType, setWpPostType] = useState("post");
  const [wpTaxonomy, setWpTaxonomy] = useState("category");
  const [wpUsePolylang, setWpUsePolylang] = useState(false);

  const [languages, setLanguages] = useState<SupportedLanguageItem[]>([]);
  const [newLangCode, setNewLangCode] = useState("");
  const [newLangName, setNewLangName] = useState("");
  const [languageError, setLanguageError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [settingsData, keyData, wpData, langData] = await Promise.all([
          getSettings(),
          getOpenAIKey(),
          getWordPressIntegration(),
          getLanguages(),
        ]);
        if (cancelled) return;

        setSettings(settingsData);
        setOpenaiKey(keyData);
        setWpSiteUrl(wpData.site_url ?? "");
        setWpUsername(wpData.username ?? "");
        setWpHasPassword(wpData.has_password);
        setWpPostType(wpData.post_type ?? "post");
        setWpTaxonomy(wpData.taxonomy ?? "category");
        setWpUsePolylang(wpData.use_polylang_linking ?? false);
        if (wpData.last_test_status) {
          setWpLastTest({
            status: wpData.last_test_status,
            message: wpData.last_test_message,
            at: wpData.last_tested_at,
          });
        }
        setLanguages(langData);
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
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

  async function handleSaveKey() {
    if (!openaiKeyInput.trim()) {
      setError("Enter an API key first.");
      return;
    }
    setError(null);
    setSavingKey(true);
    try {
      const result = await updateOpenAIKey(openaiKeyInput.trim());
      setOpenaiKey(result);
      setOpenaiKeyInput("");
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    } catch {
      setError("Failed to save API key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleSaveWp() {
    setError(null);
    setSavingWp(true);
    try {
      const payload: {
        site_url?: string;
        username?: string;
        app_password?: string;
        post_type?: string;
        taxonomy?: string;
        use_polylang_linking?: boolean;
      } = {
        site_url: wpSiteUrl,
        username: wpUsername,
        post_type: wpPostType,
        taxonomy: wpTaxonomy,
        use_polylang_linking: wpUsePolylang,
      };
      if (wpPassword.trim()) {
        payload.app_password = wpPassword.trim();
      }
      const result = await updateWordPressIntegration(payload);
      setWpHasPassword(result.has_password);
      setWpPassword("");
      setWpSaved(true);
      setTimeout(() => setWpSaved(false), 2000);
    } catch {
      setError("Failed to save WordPress settings");
    } finally {
      setSavingWp(false);
    }
  }

  async function handleTestWp() {
    setError(null);
    setTestingWp(true);
    setWpTestResult(null);
    try {
      const result = await testWordPressConnection();
      setWpTestResult(result);
    } catch {
      setWpTestResult({ success: false, message: "Failed to reach the backend." });
    } finally {
      setTestingWp(false);
    }
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
    } catch (err) {
      setLanguageError(err instanceof Error ? err.message : "Failed to add language");
    }
  }

  async function handleDeleteLanguage(code: string) {
    await deleteLanguage(code);
    setLanguages((prev) => prev.filter((l) => l.code !== code));
  }

  if (loading) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-2xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
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
          {"\u2190"} Dashboard
        </button>
        <h1 className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
          Settings
        </h1>
      </header>

      {error && (
        <div
          className="mb-6 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <div className="space-y-6">
        <Card title="Account" description="Single-user local setup — no login required yet." collapsible defaultOpen={false}>
          <div
            className="rounded-md border-[1.5px] border-dashed p-4 text-sm"
            style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}
          >
            Account management (name, email, sign-in) will live here in a future multi-user version.
          </div>
        </Card>

        <Card title="AI Provider" description="Used for image generation (gpt-image-2) and translation (gpt-4o-mini)." collapsible defaultOpen={false}>
          {openaiKey?.has_key && (
            <p className="text-sm mb-2" style={{ color: "var(--ink)" }}>
              Current key: <span className="font-mono">{openaiKey.masked_key}</span>
            </p>
          )}
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            {openaiKey?.has_key ? "Replace API key" : "OpenAI API key"}
          </label>
          <input
            type="password"
            value={openaiKeyInput}
            onChange={(e) => setOpenaiKeyInput(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
          <SaveRow onClick={handleSaveKey} saving={savingKey} saved={keySaved} label="Save key" />
          {keySaved && (
            <p className="mt-2 text-xs" style={{ color: "var(--pencil)" }}>
              Takes effect immediately, no restart needed.
            </p>
          )}
        </Card>

        <Card title="Integrations" description="Connect external services to publish directly from this app." collapsible defaultOpen={false}>
          <SubCard title="WordPress" description="Connect a WordPress site to publish directly from this app.">
            <div className="space-y-3 mb-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                  Site URL
                </label>
                <input
                  type="text"
                  value={wpSiteUrl}
                  onChange={(e) => setWpSiteUrl(e.target.value)}
                  placeholder="https://yoursite.com"
                  className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                  Username
                </label>
                <input
                  type="text"
                  value={wpUsername}
                  onChange={(e) => setWpUsername(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                  {wpHasPassword ? "Replace Application Password" : "Application Password"}
                </label>
                <input
                  type="password"
                  value={wpPassword}
                  onChange={(e) => setWpPassword(e.target.value)}
                  placeholder={wpHasPassword ? "•••• •••• •••• ••••" : "xxxx xxxx xxxx xxxx"}
                  className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                    Post type
                  </label>
                  <input
                    type="text"
                    value={wpPostType}
                    onChange={(e) => setWpPostType(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                    style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                    Taxonomy
                  </label>
                  <input
                    type="text"
                    value={wpTaxonomy}
                    onChange={(e) => setWpTaxonomy(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                    style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-5 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
              <button
                onClick={handleSaveWp}
                disabled={savingWp}
                className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--teal)" }}
              >
                {savingWp ? "Saving..." : "Save"}
              </button>
              {wpSaved && <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>Saved</span>}
              <button
                onClick={handleTestWp}
                disabled={testingWp}
                className="px-4 py-2 rounded-md text-sm font-medium border-[1.5px] disabled:opacity-60"
                style={{ color: "var(--pencil)", borderColor: "var(--pencil-light)" }}
              >
                {testingWp ? "Testing..." : "Test connection"}
              </button>
            </div>

            {wpTestResult && (
              <p className="mt-3 text-sm" style={{ color: wpTestResult.success ? "var(--teal)" : "var(--coral-dark)" }}>
                {wpTestResult.message}
              </p>
            )}
            {!wpTestResult && wpLastTest && (
              <p className="mt-3 text-xs" style={{ color: "var(--pencil)" }}>
                Last test: {wpLastTest.status} — {wpLastTest.message}
              </p>
            )}

            <div className="mt-5 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
              <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--pencil)" }}>
                Plugins
              </h3>
              <SubCard title="Polylang Pro">
                <label className="flex items-center gap-2 text-sm mb-1.5" style={{ color: "var(--ink)" }}>
                  <input
                    type="checkbox"
                    checked={wpUsePolylang}
                    onChange={(e) => setWpUsePolylang(e.target.checked)}
                  />
                  Use Polylang Pro linking
                </label>
                <p className="text-xs" style={{ color: "var(--pencil)" }}>
                  Only enable once Polylang Pro is active on this site — links posts and taxonomy terms across
                  languages.
                </p>
              </SubCard>
            </div>
          </SubCard>
        </Card>

        <Card title="Languages" description="Available languages for translations across the app." collapsible defaultOpen={false}>
          {languageError && (
            <p className="text-sm mb-2" style={{ color: "var(--coral-dark)" }}>
              {languageError}
            </p>
          )}

          <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
            {languages.map((lang) => (
              <div
                key={lang.code}
                className="flex items-center justify-between rounded-md border-[1.5px] px-3 py-2"
                style={{ borderColor: "var(--pencil-light)" }}
              >
                <span className="text-sm" style={{ color: "var(--ink)" }}>
                  {lang.name} <span style={{ color: "var(--pencil)" }}>({lang.code})</span>
                </span>
                <button
                  onClick={() => handleDeleteLanguage(lang.code)}
                  className="text-xs"
                  style={{ color: "var(--coral-dark)" }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newLangCode}
              onChange={(e) => setNewLangCode(e.target.value)}
              placeholder="Code (e.g. nl)"
              className="w-32 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
            <input
              type="text"
              value={newLangName}
              onChange={(e) => setNewLangName(e.target.value)}
              placeholder="Name (e.g. Dutch)"
              className="flex-1 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            />
            <button
              onClick={handleAddLanguage}
              className="px-4 py-2 rounded-md text-sm font-medium text-white"
              style={{ background: "var(--teal)" }}
            >
              Add
            </button>
          </div>
        </Card>

        {settings && (
          <Card title="Generation behavior" description="Pacing between API calls and safety confirmation." collapsible defaultOpen={false}>
            <div className="grid grid-cols-2 gap-5 mb-4">
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

            <div className="flex items-center gap-4 mt-5 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
                style={{ background: "var(--teal)" }}
              >
                {saving ? "Saving..." : "Save settings"}
              </button>
              <button
                onClick={handleResetDefaults}
                className="px-4 py-2 rounded-md text-sm font-medium"
                style={{ color: "var(--pencil)" }}
              >
                Reset to defaults
              </button>
              {saved && <span className="text-sm font-medium" style={{ color: "var(--teal)" }}>Saved</span>}
              {resetApplied && (
                <span className="text-sm font-medium" style={{ color: "var(--pencil)" }}>
                  Defaults applied — click Save to persist
                </span>
              )}
            </div>
          </Card>
        )}

        <BackupSettingsPanel />
      </div>
    </main>
  );
}
