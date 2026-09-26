"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldCheck, UserRound, KeyRound, Sparkles, ChevronRight } from "lucide-react";
import { ApiError, getAuthHeaders } from "@/lib/api";
import { AccountSection, SubCard, SaveRow, Toggle } from "@/components/SettingsUI";
import BookWordPressMapping from "@/components/BookWordPressMapping";
import AppShell from "@/components/AppShell";
import type { components } from "@/lib/api/generated-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type OpenAIKeyRead = components["schemas"]["OpenAIKeyRead"];
type WordPressIntegrationRead = components["schemas"]["WordPressIntegrationRead"];

// Not yet in generated-types.ts — these are new (task 5, per-user OpenAI
// keys) and generated-types.ts is regenerated from the backend's OpenAPI
// schema as a separate step. Defined locally for now; safe to switch to
// components["schemas"][...] once that regeneration is run.
type CurrentUserRead = { id: number; email: string; name: string; is_admin: boolean };
type UserSummary = { id: number; email: string; name: string; is_admin: boolean };
type OpenAIUserKeyRead = { user_id: number | null; user: UserSummary | null; has_key: boolean; masked_key: string | null };
type OpenAIKeyListResponse = { house: OpenAIUserKeyRead; personal_keys: OpenAIUserKeyRead[] };

async function getCurrentUser(): Promise<CurrentUserRead> {
  const res = await fetch(`${API_BASE_URL}/auth/me`, { headers: await getAuthHeaders() });
  return res.json();
}
async function getOpenAIKey(): Promise<OpenAIKeyRead> {
  const res = await fetch(`${API_BASE_URL}/account/openai-key`, { headers: await getAuthHeaders() });
  return res.json();
}
async function updateOpenAIKey(key: string): Promise<OpenAIKeyRead> {
  const res = await fetch(`${API_BASE_URL}/account/openai-key`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ openai_api_key: key }),
  });
  return res.json();
}
async function getAllUsers(): Promise<UserSummary[]> {
  const res = await fetch(`${API_BASE_URL}/account/users`, { headers: await getAuthHeaders() });
  if (!res.ok) return [];
  return res.json();
}
async function getOpenAIKeyList(): Promise<OpenAIKeyListResponse | null> {
  const res = await fetch(`${API_BASE_URL}/account/openai-keys`, { headers: await getAuthHeaders() });
  if (!res.ok) return null;
  return res.json();
}
async function updateUserOpenAIKey(userId: number, key: string) {
  const res = await fetch(`${API_BASE_URL}/account/openai-keys/user/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify({ openai_api_key: key }),
  });
  return res.json();
}
async function deleteUserOpenAIKey(userId: number) {
  await fetch(`${API_BASE_URL}/account/openai-keys/user/${userId}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
}
async function getWordPressIntegration(): Promise<WordPressIntegrationRead> {
  const res = await fetch(`${API_BASE_URL}/account/wordpress`, { headers: await getAuthHeaders() });
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
    headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
    body: JSON.stringify(data),
  });
  return res.json();
}
async function testWordPressConnection(): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${API_BASE_URL}/account/wordpress/test`, { method: "POST", headers: await getAuthHeaders() });
  return res.json();
}

export default function AccountPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUserRead | null>(null);
  const [openaiKey, setOpenaiKey] = useState<OpenAIKeyRead | null>(null);
  const [openaiKeyInput, setOpenaiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Admin-only per-user key management (task 5) — only fetched/shown when
  // currentUser.is_admin is true. Regular users just see the house key's
  // status above, with no way to add their own (admin-only by design).
  const [keyList, setKeyList] = useState<OpenAIKeyListResponse | null>(null);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [pickerUserId, setPickerUserId] = useState<string>("");
  const [pickerKeyInput, setPickerKeyInput] = useState("");
  const [savingUserKey, setSavingUserKey] = useState(false);

  const [wpSiteUrl, setWpSiteUrl] = useState("");
  const [wpUsername, setWpUsername] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [wpHasPassword, setWpHasPassword] = useState(false);
  const [savingWp, setSavingWp] = useState(false);
  const [wpSaved, setWpSaved] = useState(false);
  const [testingWp, setTestingWp] = useState(false);
  const [wpTestResult, setWpTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [wpLastTest, setWpLastTest] = useState<{ status?: string; message?: string | null; at?: string | null } | null>(null);
  const [wpPostType, setWpPostType] = useState("post");
  const [wpTaxonomy, setWpTaxonomy] = useState("category");
  const [wpUsePolylang, setWpUsePolylang] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Same tabs treatment as the Settings page — Profile/AI provider/Integrations
  // were three stacked cards, now switched via tabs labeled by their titles.
  const [activeTab, setActiveTab] = useState<"profile" | "ai" | "integrations">("profile");

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const [userData, keyData, wpData] = await Promise.all([getCurrentUser(), getOpenAIKey(), getWordPressIntegration()]);
        if (cancelled) return;
        setCurrentUser(userData);
        setOpenaiKey(keyData);
        if (userData.is_admin) {
          const [list, users] = await Promise.all([getOpenAIKeyList(), getAllUsers()]);
          if (cancelled) return;
          setKeyList(list);
          setAllUsers(users);
        }
        setWpSiteUrl(wpData.site_url ?? "");
        setWpUsername(wpData.username ?? "");
        setWpHasPassword(wpData.has_password);
        setWpPostType(wpData.post_type ?? "post");
        setWpTaxonomy(wpData.taxonomy ?? "category");
        setWpUsePolylang(wpData.use_polylang_linking ?? false);
        if (wpData.last_test_status) {
          setWpLastTest({ status: wpData.last_test_status, message: wpData.last_test_message, at: wpData.last_tested_at });
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load account");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

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

  async function refreshKeyList() {
    const list = await getOpenAIKeyList();
    setKeyList(list);
  }

  async function handleAssignUserKey() {
    if (!pickerUserId || !pickerKeyInput.trim()) {
      setError("Pick a user and enter a key first.");
      return;
    }
    setError(null);
    setSavingUserKey(true);
    try {
      await updateUserOpenAIKey(Number(pickerUserId), pickerKeyInput.trim());
      setPickerKeyInput("");
      setPickerUserId("");
      await refreshKeyList();
    } catch {
      setError("Failed to save that user's API key");
    } finally {
      setSavingUserKey(false);
    }
  }

  async function handleRemoveUserKey(userId: number) {
    setError(null);
    try {
      await deleteUserOpenAIKey(userId);
      await refreshKeyList();
    } catch {
      setError("Failed to remove that user's API key");
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
      if (wpPassword.trim()) payload.app_password = wpPassword.trim();
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

  return (
    <AppShell active="Overview" breadcrumb="Account">
      {/* Same fixed two-column bug as Settings and the old CategorySequenceShell
          layout (see the "responsive-ui-audit" project doc) — stacks below
          lg instead of squeezing the content against a hardcoded 270px
          column. */}
      <div className="grid mx-auto grid-cols-1 lg:grid-cols-[minmax(0,1fr)_270px] gap-6" style={{ maxWidth: 1120 }}>
        <div>
          <div className="flex items-end justify-between gap-6 mb-9">
            <div>
              <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
                Your workspace
              </p>
              <h1
                className="font-display font-normal m-0 mt-2"
                style={{ fontSize: "clamp(32px, 4vw, 44px)", letterSpacing: "-0.045em", color: "var(--ink)" }}
              >
                Account<span style={{ color: "var(--teal)" }}>.</span>
              </h1>
              <p className="text-[13px] m-0 mt-2" style={{ color: "var(--pencil)", maxWidth: 480 }}>
                Your credentials and publishing connections in one calm place.
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
              <div className="flex gap-2">
                {(
                  [
                    { id: "profile", label: "Profile" },
                    { id: "ai", label: "AI provider" },
                    { id: "integrations", label: "Integrations" },
                  ] as const
                ).map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className="px-4 py-2 rounded-full text-xs font-bold"
                      style={{
                        border: `1px solid ${active ? "var(--account-accent-border)" : "var(--pencil-light)"}`,
                        background: active ? "var(--account-accent-bg)" : "transparent",
                        color: active ? "var(--ink)" : "var(--pencil)",
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === "profile" && (
              <AccountSection
                eyebrow="Your workspace"
                title="Profile"
                description="Single-user local setup — no login required yet."
                icon={<UserRound size={16} />}
                accent
              >
                <div className="rounded-md border-[1.5px] border-dashed p-4 text-sm" style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}>
                  Account management (name, email, sign-in) will live here in a future multi-user version.
                </div>
              </AccountSection>
              )}

              {activeTab === "ai" && (
              <AccountSection
                eyebrow="Generation credentials"
                title="AI provider"
                description="Used for image generation (gpt-image-2) and translation (gpt-4o-mini)."
                icon={<KeyRound size={16} />}
                accent
              >
                {currentUser && !currentUser.is_admin ? (
                  <div className="rounded-md border-[1.5px] border-dashed p-4 text-sm" style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}>
                    OpenAI keys are managed by your admin.{" "}
                    {openaiKey?.has_key ? "A shared key is currently configured." : "No shared key is configured yet."}
                  </div>
                ) : (
                  <>
                    <SubCard title="House key" description="The shared fallback — used by any user with no personal key of their own." defaultOpen>
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
                        style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                      />
                      <SaveRow onClick={handleSaveKey} saving={savingKey} saved={keySaved} label="Save key" />
                      {keySaved && (
                        <p className="mt-2 text-xs" style={{ color: "var(--pencil)" }}>
                          Takes effect immediately, no restart needed.
                        </p>
                      )}
                    </SubCard>

                    <div className="mt-4">
                      <SubCard
                        title="Per-user keys"
                        description="Optional — a user with no personal key here automatically uses the house key above. Temporary, until everyone is consolidated onto one app-wide key."
                      >
                        {keyList && keyList.personal_keys.length > 0 && (
                          <div className="space-y-2 mb-4">
                            {keyList.personal_keys.map((row) => (
                              <div
                                key={row.user_id}
                                className="flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm"
                                style={{ background: "var(--canvas)", border: "1px solid var(--pencil-light)" }}
                              >
                                <div>
                                  <span className="font-medium" style={{ color: "var(--ink)" }}>{row.user?.name ?? `User #${row.user_id}`}</span>
                                  <span className="ml-2 font-mono text-xs" style={{ color: "var(--pencil)" }}>{row.masked_key}</span>
                                </div>
                                <button
                                  onClick={() => row.user_id !== null && handleRemoveUserKey(row.user_id)}
                                  className="text-xs font-medium"
                                  style={{ color: "var(--coral-dark)" }}
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                          Assign a personal key
                        </label>
                        <div className="flex flex-col gap-2">
                          <select
                            value={pickerUserId}
                            onChange={(e) => setPickerUserId(e.target.value)}
                            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                            style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                          >
                            <option value="">Choose a user...</option>
                            {allUsers.map((u) => (
                              <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                            ))}
                          </select>
                          <input
                            type="password"
                            value={pickerKeyInput}
                            onChange={(e) => setPickerKeyInput(e.target.value)}
                            placeholder="sk-..."
                            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                            style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                          />
                          <SaveRow onClick={handleAssignUserKey} saving={savingUserKey} saved={false} label="Assign key" />
                        </div>
                      </SubCard>
                    </div>
                  </>
                )}
              </AccountSection>
              )}

              {activeTab === "integrations" && (
              <AccountSection
                eyebrow="Publishing destination"
                title="Integrations"
                description="Connect external services to publish directly from this app."
                icon={<Sparkles size={16} />}
                accent
              >
                <SubCard title="WordPress" description="Connect a WordPress site to publish directly from this app." defaultOpen>
                  <div className="space-y-3 mb-3">
                    <div>
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>Site URL</label>
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
                      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>Username</label>
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>Post type</label>
                        <input
                          type="text"
                          value={wpPostType}
                          onChange={(e) => setWpPostType(e.target.value)}
                          className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>Taxonomy</label>
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
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border-[1.5px] disabled:opacity-60"
                      style={{ color: "var(--pencil)", borderColor: "var(--pencil-light)" }}
                    >
                      {testingWp ? "Testing..." : "Test connection"} <ChevronRight size={13} />
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
                      <div className="flex items-center justify-between gap-5">
                        <div>
                          <p className="text-xs font-medium m-0 mb-1" style={{ color: "var(--ink)" }}>
                            Use Polylang Pro linking
                          </p>
                          <p className="text-[10px] m-0" style={{ color: "var(--pencil)" }}>
                            Only enable once Polylang Pro is active on this site — links posts and taxonomy terms across languages.
                          </p>
                        </div>
                        <Toggle checked={wpUsePolylang} onChange={setWpUsePolylang} />
                      </div>
                    </SubCard>
                  </div>

                  <div className="mt-5 pt-4 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
                    <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--pencil)" }}>
                      Book mapping
                    </h3>
                    <SubCard title="WordPress categories">
                      <BookWordPressMapping />
                    </SubCard>
                  </div>
                </SubCard>
              </AccountSection>
              )}
            </div>
          )}
        </div>

        <aside>
          <div className="rounded-xl p-5 lg:sticky" style={{ top: 90, border: "1px solid var(--tone-blue)", background: "var(--tone-blue-bg)" }}>
            <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--tone-blue)", letterSpacing: "0.1em" }}>
              Quick guide
            </p>
            <h3 className="font-display font-normal m-0 mt-1.5" style={{ fontSize: 18, color: "var(--ink)" }}>
              Everything in its place.
            </h3>
            <p className="text-xs m-0 mt-2" style={{ color: "var(--pencil)" }}>
              Account holds credentials and destinations. Settings holds how the app behaves.
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
