"use client";

import { useState, useEffect } from "react";
import { Card, SaveRow } from "./SettingsUI";
import type { components } from "@/lib/api/generated-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const INTERVAL_OPTIONS = [
  { label: "Every 6 hours", hours: 6 },
  { label: "Every 12 hours", hours: 12 },
  { label: "Once a day", hours: 24 },
  { label: "Once a week", hours: 168 },
];

const RETENTION_OPTIONS = [
  { label: "Keep last 3", count: 3 },
  { label: "Keep last 5", count: 5 },
];

type BackupSettings = components["schemas"]["BackupSettingsRead"];
type BackupRecord = components["schemas"]["BackupRecordRead"];

async function getBackupSettings(): Promise<BackupSettings> {
  const res = await fetch(`${API_BASE_URL}/backup/settings`);
  return res.json();
}

async function updateBackupSettings(payload: Record<string, unknown>): Promise<BackupSettings> {
  const res = await fetch(`${API_BASE_URL}/backup/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function runBackupNow(): Promise<BackupRecord> {
  const res = await fetch(`${API_BASE_URL}/backup/run`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Backup failed");
  }
  return res.json();
}

async function getBackupHistory(): Promise<BackupRecord[]> {
  const res = await fetch(`${API_BASE_URL}/backup/history`);
  return res.json();
}

async function restoreBackup(timestamp: string): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE_URL}/backup/restore/${timestamp}`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Restore failed");
  }
  return res.json();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTimestamp(ts: string): string {
  // ts like "20260819_061827"
  const match = ts.match(/^(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})$/);
  if (!match) return ts;
  const [, y, mo, d, h, mi] = match;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:00`);
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatIsoDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function BackupSettingsPanel() {
  const [settings, setSettings] = useState<BackupSettings | null>(null);
  const [history, setHistory] = useState<BackupRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [justRanBackup, setJustRanBackup] = useState(false);

  const [confirmingRestore, setConfirmingRestore] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreResult, setRestoreResult] = useState<string | null>(null);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      const [s, h] = await Promise.all([getBackupSettings(), getBackupHistory()]);
      setSettings(s);
      setHistory(h);
    } catch {
      setError("Failed to load backup settings");
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      const updated = await updateBackupSettings({
        auto_backup_enabled: settings.auto_backup_enabled,
        backup_interval_hours: settings.backup_interval_hours,
        local_retention_count: settings.local_retention_count,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Failed to save backup settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunNow() {
    setRunningBackup(true);
    setError(null);
    try {
      await runBackupNow();
      await load(false);
      setJustRanBackup(true);
      setTimeout(() => setJustRanBackup(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backup failed");
    } finally {
      setRunningBackup(false);
    }
  }

  async function handleConfirmRestore(timestamp: string) {
    setRestoring(true);
    setError(null);
    try {
      const result = await restoreBackup(timestamp);
      setRestoreResult(result.message);
      setConfirmingRestore(null);
      await load(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Restore failed");
    } finally {
      setRestoring(false);
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading...</p>;
  }

  if (!settings) {
    return <p className="text-sm" style={{ color: "var(--coral-dark)" }}>{error ?? "Failed to load"}</p>;
  }

  return (
    <Card
      title="Backups"
      description="Automatically snapshots the database and generated content when the app starts, if the last backup is older than the interval below."
      collapsible
      defaultOpen={false}
    >

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {restoreResult && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm font-medium"
          style={{ background: "var(--paper)", color: "var(--ink)", border: "1.5px solid var(--teal)" }}
        >
          {restoreResult}
        </div>
      )}

      <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>
        Last backup:{" "}
        <span style={{ color: "var(--pencil)" }}>
          {settings.last_backup_at ? formatIsoDate(settings.last_backup_at) : "Never"}
        </span>
      </p>

      <label className="flex items-center gap-2 text-sm mb-4" style={{ color: "var(--ink)" }}>
        <input
          type="checkbox"
          checked={settings.auto_backup_enabled}
          onChange={(e) => setSettings({ ...settings, auto_backup_enabled: e.target.checked })}
        />
        Automatically back up on startup when overdue
      </label>

      <div className="grid grid-cols-2 gap-5 mb-5">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            How often to back up
          </label>
          <select
            value={settings.backup_interval_hours}
            onChange={(e) => setSettings({ ...settings, backup_interval_hours: parseInt(e.target.value) })}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          >
            {INTERVAL_OPTIONS.map((opt) => (
              <option key={opt.hours} value={opt.hours}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            How many backups to keep
          </label>
          <select
            value={settings.local_retention_count}
            onChange={(e) => setSettings({ ...settings, local_retention_count: parseInt(e.target.value) })}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          >
            {RETENTION_OPTIONS.map((opt) => (
              <option key={opt.count} value={opt.count}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs" style={{ color: "var(--pencil)" }}>
            Older backups beyond this number are deleted automatically to save disk space.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 pb-6 border-b-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
        <SaveRow onClick={handleSave} saving={saving} saved={saved} />
        <button
          onClick={handleRunNow}
          disabled={runningBackup}
          className="px-4 py-2 rounded-md text-sm font-medium border-[1.5px] disabled:opacity-60"
          style={{ borderColor: "var(--teal)", color: "var(--teal)" }}
        >
          {runningBackup ? "Backing up..." : "Backup now"}
        </button>
        {justRanBackup && (
          <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
            Backup complete
          </span>
        )}
      </div>

      <h3 className="text-sm font-medium mb-3" style={{ color: "var(--ink)" }}>
        Recent backups
      </h3>
      {history.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>
          No backups yet.
        </p>
      ) : (
        <div className="space-y-1.5">
          {history.map((r) => (
            <div
              key={r.timestamp}
              className="rounded-md border-[1.5px]"
              style={{ borderColor: r.success ? "var(--pencil-light)" : "var(--coral)" }}
            >
              <div className="flex items-center justify-between px-3 py-2 text-xs">
                <span style={{ color: "var(--ink)" }}>
                  {formatTimestamp(r.timestamp)}{" "}
                  <span style={{ color: "var(--pencil)" }}>
                    ({r.triggered_by}) — {formatBytes(r.db_size_bytes + r.content_size_bytes)}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <span style={{ color: r.success ? "var(--teal)" : "var(--coral-dark)" }}>
                    {r.success ? "Success" : r.error_message ?? "Failed"}
                  </span>
                  {r.success && confirmingRestore !== r.timestamp && (
                    <button
                      onClick={() => setConfirmingRestore(r.timestamp)}
                      className="font-medium"
                      style={{ color: "var(--pencil)" }}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
              {confirmingRestore === r.timestamp && (
                <div
                  className="px-3 pb-3 pt-1 border-t-[1.5px]"
                  style={{ borderColor: "var(--pencil-light)", background: "var(--coral-light)" }}
                >
                  <p className="text-xs mb-2" style={{ color: "var(--coral-dark)" }}>
                    This replaces your current database and files with this backup. Your current state is
                    backed up automatically first, so this can be undone — but requires restarting the server
                    afterward.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleConfirmRestore(r.timestamp)}
                      disabled={restoring}
                      className="px-3 py-1.5 rounded text-xs font-medium text-white disabled:opacity-60"
                      style={{ background: "var(--coral)" }}
                    >
                      {restoring ? "Restoring..." : "Yes, restore this backup"}
                    </button>
                    <button
                      onClick={() => setConfirmingRestore(null)}
                      disabled={restoring}
                      className="text-xs font-medium"
                      style={{ color: "var(--pencil)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
