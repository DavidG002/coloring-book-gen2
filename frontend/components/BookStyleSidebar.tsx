"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Palette } from "lucide-react";
import { getBook, updateBook, getAuthHeaders, ApiError, type Book } from "@/lib/api";
import { PAPER_PRESETS } from "./SettingsUI";
import KnobsPanel from "./KnobsPanel";
import ExpandableTextModal from "./ExpandableTextModal";

export default function BookStyleSidebar({
  bookId,
  categoryName,
  onLiveImageSettingsChange,
}: {
  bookId: number;
  categoryName?: string;
  // Mirrors BookSettingsFields' own live-preview callback — lets whatever
  // renders this sidebar (the Generate step's default-canvas placeholder)
  // reflect slider changes immediately, before Save is clicked.
  onLiveImageSettingsChange?: (settings: { canvas_width: number; canvas_height: number; subject_size_ratio: number }) => void;
}) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  const [basePrompt, setBasePrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

  const [canvasWidth, setCanvasWidth] = useState(595);
  const [canvasHeight, setCanvasHeight] = useState(842);
  const [subjectSizeRatio, setSubjectSizeRatio] = useState(0.5);
  const [whiteThreshold, setWhiteThreshold] = useState(245);
  const [blackThreshold, setBlackThreshold] = useState(10);
  const [paletteColors, setPaletteColors] = useState(8);
  const [savingImageSettings, setSavingImageSettings] = useState(false);
  const [imageSettingsSaved, setImageSettingsSaved] = useState(false);

  const [imageSettingsOpen, setImageSettingsOpen] = useState(false);
  const [knobsOpen, setKnobsOpen] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryName) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/categories/by-name/${bookId}/${encodeURIComponent(categoryName)}/base-prompt`,
          { headers: await getAuthHeaders() }
        );
        const data = await res.json();
        if (!cancelled && res.ok) setBasePrompt(data.base_prompt);
      } catch {
        // best-effort — keep whatever was showing if this fails
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryName, bookId]);

   useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
                const data = await getBook(bookId);
        if (cancelled) return;
        setBook(data);
        if (!categoryName) setBasePrompt(data.base_prompt);
        setCanvasWidth(data.canvas_width);
        setCanvasHeight(data.canvas_height);
        setSubjectSizeRatio(data.subject_size_ratio);
        setWhiteThreshold(data.white_clean_threshold);
        setBlackThreshold(data.black_clean_threshold);
        setPaletteColors(data.palette_colors);
      } catch {
        // silent — this is a secondary panel, main page load isn't blocked by it
      } finally {
        if (!cancelled) setLoading(false);
      }

      if (typeof window !== "undefined") {
        const savedImageSettings = window.localStorage.getItem(`book-style-image-settings-${bookId}`);
        if (savedImageSettings !== null) setImageSettingsOpen(savedImageSettings === "1");
        const savedKnobs = window.localStorage.getItem(`book-style-knobs-${bookId}`);
        if (savedKnobs !== null) setKnobsOpen(savedKnobs === "1");
      }
      if (!cancelled) setPrefsLoaded(true);
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  useEffect(() => {
    if (!prefsLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(`book-style-image-settings-${bookId}`, imageSettingsOpen ? "1" : "0");
  }, [imageSettingsOpen, prefsLoaded, bookId]);

  useEffect(() => {
    if (!prefsLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(`book-style-knobs-${bookId}`, knobsOpen ? "1" : "0");
  }, [knobsOpen, prefsLoaded, bookId]);

  // Live-preview the canvas shape and subject-size square as the user drags
  // these sliders, before they hit Save — same pattern as BookSettingsFields'
  // own callback, which the book preview canvas already reads. Here it lets
  // the Generate step's default-canvas placeholder track paper size and
  // subject size immediately too.
  useEffect(() => {
    if (loading) return;
    onLiveImageSettingsChange?.({
      canvas_width: canvasWidth,
      canvas_height: canvasHeight,
      subject_size_ratio: subjectSizeRatio,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasWidth, canvasHeight, subjectSizeRatio, loading]);

  async function handleSavePrompt(value?: string) {
    setError(null);
    const trimmed = (value ?? basePrompt).trim();
    if (!trimmed) {
      setError("Creative direction cannot be empty.");
      return;
    }
    setSavingPrompt(true);
    try {
      if (categoryName) {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/categories/by-name/${bookId}/${encodeURIComponent(categoryName)}/base-prompt`,
          { method: "PUT", headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) }, body: JSON.stringify({ base_prompt: trimmed }) }
        );
        const data = await res.json();
        if (!res.ok) throw new ApiError(res.status, data.detail);
        setBasePrompt(data.base_prompt);
      } else {
        const updated = await updateBook(bookId, { base_prompt: trimmed });
        setBasePrompt(updated.base_prompt);
        setBook(updated);
      }
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save creative direction");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleSaveImageSettings() {
    setError(null);
    setSavingImageSettings(true);
    try {
      const updated = await updateBook(bookId, {
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        subject_size_ratio: subjectSizeRatio,
        white_clean_threshold: whiteThreshold,
        black_clean_threshold: blackThreshold,
        palette_colors: paletteColors,
      });
      setBook(updated);
      setImageSettingsSaved(true);
      setTimeout(() => setImageSettingsSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save image settings");
    } finally {
      setSavingImageSettings(false);
    }
  }

  const selectedPresetLabel = PAPER_PRESETS.find((p) => p.width === canvasWidth && p.height === canvasHeight)?.label;

  if (loading || !book) {
    return null;
  }

  return (
    <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--pencil-light)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Palette size={13} style={{ color: "var(--pencil)" }} />
        <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
          Book style
        </p>
      </div>

      {error && (
        <p className="text-[10px] mb-3" style={{ color: "var(--coral-dark)" }}>
          {error}
        </p>
      )}

      {/* Creative direction — always visible, its own permanent section */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold m-0" style={{ color: "var(--ink)" }}>
            Creative direction
          </p>
          <ExpandableTextModal
            label="Creative direction"
            value={basePrompt}
            onChange={setBasePrompt}
            onSave={handleSavePrompt}
            saving={savingPrompt}
            saved={promptSaved}
            placeholder="Describe the shared style for every category in this book."
          />
        </div>
        <textarea
          value={basePrompt}
          onChange={(e) => setBasePrompt(e.target.value)}
          spellCheck={true}
          rows={4}
          className="w-full px-2.5 py-2 rounded-md outline-none text-[11px] leading-relaxed"
          style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)", color: "var(--ink)", resize: "vertical" }}
        />
        <div className="flex items-center gap-2 mt-1.5">
          <button
            onClick={() => handleSavePrompt()}
            disabled={savingPrompt}
            className="text-[10px] font-bold disabled:opacity-60"
            style={{ color: "var(--teal)" }}
          >
            {savingPrompt ? "Saving..." : "Save"}
          </button>
          {promptSaved && (
            <span className="text-[10px]" style={{ color: "var(--teal)" }}>
              Saved
            </span>
          )}
        </div>
      </div>

      {/* Image settings — subset only: no canvas size, no book basics, no watermark */}
      <div className="mb-5">
        <button
          onClick={() => setImageSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between mb-2"
        >
          <p className="text-[10px] font-bold m-0" style={{ color: "var(--ink)" }}>
            Image settings
          </p>
          <ChevronDown
            size={13}
            style={{ color: "var(--pencil)", transform: imageSettingsOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
          />
        </button>
        {imageSettingsOpen && (
        <>
        <div className="mb-4 pb-4" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
          <p className="text-[9px] uppercase font-bold mb-2" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
            Paper size
          </p>
          <select
            value={canvasWidth === 0 ? "custom" : (selectedPresetLabel ?? "custom")}
            onChange={(e) => {
              if (e.target.value === "custom") {
                setCanvasWidth(0);
                setCanvasHeight(0);
                return;
              }
              const preset = PAPER_PRESETS.find((p) => p.label === e.target.value);
              if (preset) {
                setCanvasWidth(preset.width);
                setCanvasHeight(preset.height);
              }
            }}
            className="w-full px-2 py-1.5 rounded text-[10px] outline-none"
            style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
          >
            {PAPER_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
            <option value="custom">Custom size</option>
          </select>

          {canvasWidth === 0 && (
            <div className="grid grid-cols-2 gap-2.5 mt-2">
              <div>
                <label className="block text-[9px] mb-1" style={{ color: "var(--pencil)" }}>
                  Width (px)
                </label>
                <input
                  type="number"
                  value={canvasWidth || ""}
                  onChange={(e) => setCanvasWidth(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1.5 rounded text-[10px] outline-none"
                  style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
                />
              </div>
              <div>
                <label className="block text-[9px] mb-1" style={{ color: "var(--pencil)" }}>
                  Height (px)
                </label>
                <input
                  type="number"
                  value={canvasHeight || ""}
                  onChange={(e) => setCanvasHeight(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2 py-1.5 rounded text-[10px] outline-none"
                  style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="mb-4 pb-4" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[9px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
              Subject size
            </p>
            <span className="text-[11px] font-bold" style={{ color: subjectSizeRatio > 0.9 ? "var(--coral)" : "var(--tone-lavender)" }}>
              {Math.round(subjectSizeRatio * 100)}%
            </span>
          </div>
          <div className="relative">
            <input
              type="range"
              min={0.2}
              max={1.2}
              step={0.05}
              value={subjectSizeRatio}
              onChange={(e) => setSubjectSizeRatio(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: subjectSizeRatio > 0.9 ? "var(--coral)" : "var(--tone-lavender)" }}
            />
            <span
              className="absolute pointer-events-none"
              style={{ left: "70%", top: 2, bottom: 2, width: 1, background: "var(--pencil-light)" }}
              title="100% — fills the canvas exactly"
            />
          </div>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Small on page</span>
            <span className="text-[9px]" style={{ color: subjectSizeRatio > 0.9 ? "var(--coral)" : "var(--pencil)" }}>
              {subjectSizeRatio > 0.9 ? "Bleeds past the edges" : "Fills the page"}
            </span>
          </div>
        </div>

        <div className="mb-2">
          <p className="text-[9px] uppercase font-bold mb-2" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
            Fine-tuning
          </p>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[9px]" style={{ color: "var(--pencil)" }}>
                Shading detail
              </label>
              <span className="text-[10px] font-bold" style={{ color: "var(--teal)" }}>
                {paletteColors}
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={24}
              step={1}
              value={paletteColors}
              onChange={(e) => setPaletteColors(parseInt(e.target.value, 10))}
              className="w-full"
              style={{ accentColor: "var(--teal)" }}
            />
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Flat black & white</span>
              <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Soft shading</span>
            </div>
          </div>

          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[9px]" style={{ color: "var(--pencil)" }}>
                Line boldness
              </label>
              <span className="text-[10px] font-bold" style={{ color: "var(--teal)" }}>
                {blackThreshold}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={60}
              step={1}
              value={blackThreshold}
              onChange={(e) => setBlackThreshold(parseInt(e.target.value, 10))}
              className="w-full"
              style={{ accentColor: "var(--teal)" }}
            />
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Preserve soft detail</span>
              <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Bold solid lines</span>
            </div>
          </div>

          <div className="mb-1">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[9px]" style={{ color: "var(--pencil)" }}>
                Background cleanup
              </label>
              <span className="text-[10px] font-bold" style={{ color: "var(--teal)" }}>
                {whiteThreshold}
              </span>
            </div>
            <input
              type="range"
              min={200}
              max={255}
              step={1}
              value={whiteThreshold}
              onChange={(e) => setWhiteThreshold(parseInt(e.target.value, 10))}
              className="w-full"
              style={{ accentColor: "var(--teal)" }}
            />
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Aggressive cleanup</span>
              <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Preserve light detail</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={handleSaveImageSettings}
            disabled={savingImageSettings}
            className="text-[10px] font-bold disabled:opacity-60"
            style={{ color: "var(--teal)" }}
          >
            {savingImageSettings ? "Saving..." : "Save"}
          </button>
          {imageSettingsSaved && (
            <span className="text-[10px]" style={{ color: "var(--teal)" }}>
              Saved
            </span>
          )}
        </div>
        </>
        )}
      </div>

      {/* Style knobs — collapsible, default open */}
      <div>
        <button
          onClick={() => setKnobsOpen((v) => !v)}
          className="w-full flex items-center justify-between mb-2"
        >
          <p className="text-[10px] font-bold m-0" style={{ color: "var(--ink)" }}>
            Style knobs
          </p>
          <ChevronDown
            size={13}
            style={{ color: "var(--pencil)", transform: knobsOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}
          />
        </button>
        {knobsOpen && (
          <div style={{ fontSize: 11 }}>
            <KnobsPanel bookId={bookId} book={book} onBookLoaded={setBook} />
          </div>
        )}
      </div>

      <p className="text-[9px] leading-relaxed mt-4 pt-3" style={{ borderTop: "1px solid var(--pencil-light)", color: "var(--pencil)" }}>
        Applies to every category in this book.
      </p>
    </div>
  );
}
