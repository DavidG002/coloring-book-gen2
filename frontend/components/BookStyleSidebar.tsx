"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Palette } from "lucide-react";
import { getBook, updateBook, ApiError, type Book } from "@/lib/api";
import KnobsPanel from "./KnobsPanel";
import ExpandableTextModal from "./ExpandableTextModal";

export default function BookStyleSidebar({ bookId }: { bookId: number }) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  const [basePrompt, setBasePrompt] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);

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
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await getBook(bookId);
        if (cancelled) return;
        setBook(data);
        setBasePrompt(data.base_prompt);
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
  }, [bookId]);

  useEffect(() => {
    if (!prefsLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(`book-style-image-settings-${bookId}`, imageSettingsOpen ? "1" : "0");
  }, [imageSettingsOpen, prefsLoaded, bookId]);

  useEffect(() => {
    if (!prefsLoaded || typeof window === "undefined") return;
    window.localStorage.setItem(`book-style-knobs-${bookId}`, knobsOpen ? "1" : "0");
  }, [knobsOpen, prefsLoaded, bookId]);

  async function handleSavePrompt(value?: string) {
    setError(null);
    const trimmed = (value ?? basePrompt).trim();
    if (!trimmed) {
      setError("Creative direction cannot be empty.");
      return;
    }
    setSavingPrompt(true);
    try {
      const updated = await updateBook(bookId, { base_prompt: trimmed });
      setBasePrompt(updated.base_prompt);
      setBook(updated);
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
        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="block text-[9px] mb-1" style={{ color: "var(--pencil)" }}>
              Subject size ratio
            </label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              value={subjectSizeRatio}
              onChange={(e) => setSubjectSizeRatio(parseFloat(e.target.value) || 0)}
              className="w-full px-2 py-1.5 rounded text-[10px] outline-none"
              style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>
          <div>
            <label className="block text-[9px] mb-1" style={{ color: "var(--pencil)" }}>
              Palette colors
            </label>
            <input
              type="number"
              step={1}
              min={2}
              value={paletteColors}
              onChange={(e) => setPaletteColors(parseInt(e.target.value, 10) || 2)}
              className="w-full px-2 py-1.5 rounded text-[10px] outline-none"
              style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>
          <div>
            <label className="block text-[9px] mb-1" style={{ color: "var(--pencil)" }}>
              Black threshold
            </label>
            <input
              type="number"
              step={1}
              min={0}
              max={255}
              value={blackThreshold}
              onChange={(e) => setBlackThreshold(parseInt(e.target.value, 10) || 0)}
              className="w-full px-2 py-1.5 rounded text-[10px] outline-none"
              style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
            />
          </div>
          <div>
            <label className="block text-[9px] mb-1" style={{ color: "var(--pencil)" }}>
              White threshold
            </label>
            <input
              type="number"
              step={1}
              min={0}
              max={255}
              value={whiteThreshold}
              onChange={(e) => setWhiteThreshold(parseInt(e.target.value, 10) || 0)}
              className="w-full px-2 py-1.5 rounded text-[10px] outline-none"
              style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
            />
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
