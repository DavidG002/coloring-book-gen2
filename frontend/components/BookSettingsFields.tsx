"use client";

import { useState, useEffect } from "react";
import { Settings2 } from "lucide-react";
import { getBook, updateBook, ApiError, type Book } from "@/lib/api";
import { Panel, PanelSection, SaveRow, Field, PAPER_PRESETS } from "./SettingsUI";
import KnobsPanel from "./KnobsPanel";
import { useSearchParams } from "next/navigation";
import ExpandableTextModal from "./ExpandableTextModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SectionKey = "basics" | "image" | "knobs" | "watermark";
const SECTION_ORDER: SectionKey[] = ["basics", "image", "knobs", "watermark"];

async function getWatermarkSettings(bookId: number) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/watermark`);
  return res.json();
}

async function updateWatermarkSettings(bookId: number, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/watermark`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function uploadWatermarkFile(bookId: number, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/watermark/upload`, {
    method: "POST",
    body: formData,
  });
  return res.json();
}

export default function BookSettingsFields({
  bookId,
  onBookLoaded,
}: {
  bookId: number;
  onBookLoaded?: (book: Book) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [book, setBook] = useState<Book | null>(null);

  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [productNoun, setProductNoun] = useState("coloring page");
  const [canvasWidth, setCanvasWidth] = useState(595);
  const [canvasHeight, setCanvasHeight] = useState(842);
  const [subjectSizeRatio, setSubjectSizeRatio] = useState(0.5);
  const [whiteThreshold, setWhiteThreshold] = useState(245);
  const [blackThreshold, setBlackThreshold] = useState(10);
  const [paletteColors, setPaletteColors] = useState(8);

  const [savingName, setSavingName] = useState(false);
  const [savingProductNoun, setSavingProductNoun] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [productNounSaved, setProductNounSaved] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkPosition, setWatermarkPosition] = useState("bottom-right");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.6);
  const [watermarkScale, setWatermarkScale] = useState(0.15);
  const [hasWatermarkFile, setHasWatermarkFile] = useState(false);
  const [savingWatermark, setSavingWatermark] = useState(false);
  const [watermarkSaved, setWatermarkSaved] = useState(false);
  const [uploadingWatermark, setUploadingWatermark] = useState(false);

  const searchParams = useSearchParams();
  const isNewBook = searchParams.get("new") === "1";
  const [activeSection, setActiveSectionState] = useState<SectionKey>(isNewBook ? "image" : "basics");
  const [sectionRestored, setSectionRestored] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [editingProductNoun, setEditingProductNoun] = useState(false);

  const [imageSettingsSnapshot, setImageSettingsSnapshot] = useState<{
  canvas_width: number;
  canvas_height: number;
  subject_size_ratio: number;
  white_clean_threshold: number;
  black_clean_threshold: number;
  palette_colors: number;
} | null>(null);

function setActiveSection(key: SectionKey) {
  setActiveSectionState(key);
  if (typeof window !== "undefined") {
    localStorage.setItem(`book-settings-section-${bookId}`, key);
  }
}

  function toggleSection(key: SectionKey) {
    if (activeSection === key) {
      const idx = SECTION_ORDER.indexOf(key);
      const next = idx < SECTION_ORDER.length - 1 ? SECTION_ORDER[idx + 1] : SECTION_ORDER[idx - 1];
      setActiveSection(next);
    } else {
      setActiveSection(key);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getBook(bookId);
        if (cancelled) return;
        setBook(data);
        setName(data.name);
        setBasePrompt(data.base_prompt);
        setProductNoun(data.product_noun);
        if (!isNewBook && typeof window !== "undefined") {
          const saved = localStorage.getItem(`book-settings-section-${bookId}`) as SectionKey | null;
          if (saved && SECTION_ORDER.includes(saved)) {
            setActiveSectionState(saved);
          }
        }
        setCanvasWidth(data.canvas_width);
        setCanvasHeight(data.canvas_height);
        setSubjectSizeRatio(data.subject_size_ratio);
        setWhiteThreshold(data.white_clean_threshold);
        setBlackThreshold(data.black_clean_threshold);
        setPaletteColors(data.palette_colors);
        setImageSettingsSnapshot({
          canvas_width: data.canvas_width,
          canvas_height: data.canvas_height,
          subject_size_ratio: data.subject_size_ratio,
          white_clean_threshold: data.white_clean_threshold,
          black_clean_threshold: data.black_clean_threshold,
          palette_colors: data.palette_colors,
        });
        onBookLoaded?.(data);

        const watermark = await getWatermarkSettings(bookId);
        if (!cancelled) {
          setWatermarkEnabled(watermark.watermark_enabled);
          setWatermarkPosition(watermark.watermark_position);
          setWatermarkOpacity(watermark.watermark_opacity);
          setWatermarkScale(watermark.watermark_scale);
          setHasWatermarkFile(watermark.has_watermark_file);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load book");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  function applyPreset(label: string) {
    const preset = PAPER_PRESETS.find((p) => p.label === label);
    if (!preset) return;
    setCanvasWidth(preset.width);
    setCanvasHeight(preset.height);
  }

  async function handleSaveName() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Book name cannot be empty.");
      return;
    }
    setSavingName(true);
    try {
      const updated = await updateBook(bookId, { name: trimmed });
      setBook(updated);
      onBookLoaded?.(updated);
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSaveProductNoun() {
    setError(null);
    const trimmed = productNoun.trim();
    if (!trimmed) {
      setError("Book type cannot be empty.");
      return;
    }
    setSavingProductNoun(true);
    try {
      const updated = await updateBook(bookId, { product_noun: trimmed });
      setBook(updated);
      onBookLoaded?.(updated);
      setProductNounSaved(true);
      setTimeout(() => setProductNounSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save book type");
    } finally {
      setSavingProductNoun(false);
    }
  }

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
      onBookLoaded?.(updated);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save creative direction");
    } finally {
      setSavingPrompt(false);
    }
  }

  async function handleSaveSettings() {
    setError(null);
    setSavingSettings(true);
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
      onBookLoaded?.(updated);
      setImageSettingsSnapshot({
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        subject_size_ratio: subjectSizeRatio,
        white_clean_threshold: whiteThreshold,
        black_clean_threshold: blackThreshold,
        palette_colors: paletteColors,
      });
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSaveWatermark() {
    setSavingWatermark(true);
    try {
      await updateWatermarkSettings(bookId, {
        watermark_enabled: watermarkEnabled,
        watermark_position: watermarkPosition,
        watermark_opacity: watermarkOpacity,
        watermark_scale: watermarkScale,
      });
      setWatermarkSaved(true);
      setTimeout(() => setWatermarkSaved(false), 2000);
    } catch {
      setError("Failed to save watermark settings");
    } finally {
      setSavingWatermark(false);
    }
  }

  async function handleWatermarkFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWatermark(true);
    try {
      await uploadWatermarkFile(bookId, file);
      setHasWatermarkFile(true);
    } catch {
      setError("Failed to upload watermark image");
    } finally {
      setUploadingWatermark(false);
    }
  }

  if (loading) {
    return <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading...</p>;
  }

  const imageSettingsDirty = imageSettingsSnapshot !== null && (
    canvasWidth !== imageSettingsSnapshot.canvas_width ||
    canvasHeight !== imageSettingsSnapshot.canvas_height ||
    subjectSizeRatio !== imageSettingsSnapshot.subject_size_ratio ||
    whiteThreshold !== imageSettingsSnapshot.white_clean_threshold ||
    blackThreshold !== imageSettingsSnapshot.black_clean_threshold ||
    paletteColors !== imageSettingsSnapshot.palette_colors
  ); 

  return (
      <Panel
        compact
        collapsible
        title={
          <span className="inline-flex items-center gap-2">
            <Settings2 size={15} style={{ color: "var(--teal)" }} /> Book settings
          </span>
        }
      >
      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

        {/* Accordion: only one open at a time; closing one advances to the next */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[10px] uppercase font-bold" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
              Creative direction
            </label>
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
            spellCheck={true}
            value={basePrompt}
            readOnly
            rows={4}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-xs leading-relaxed cursor-default"
            style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
          />
          </div>
          <PanelSection label="Book basics" open={activeSection === "basics"} onToggle={() => toggleSection("basics")}>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] uppercase font-bold" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                Book title
              </label>
              {!editingName && (
                <button
                  onClick={() => setEditingName(true)}
                  className="text-[10px] font-bold"
                  style={{ color: "var(--teal)" }}
                >
                  Edit
                </button>
              )}
            </div>
            <input
              type="text"
              spellCheck={true}
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!editingName}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-xs disabled:opacity-60"
              style={{ borderColor: "var(--pencil-light)", background: editingName ? "var(--canvas)" : "var(--paper)" }}
            />
            {editingName && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={async () => {
                    await handleSaveName();
                    setEditingName(false);
                  }}
                  disabled={savingName}
                  className="px-3.5 py-1.5 rounded-md text-[11px] font-bold text-white disabled:opacity-60"
                  style={{ background: "var(--teal)" }}
                >
                  {savingName ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditingName(false)}
                  className="text-[11px] font-medium"
                  style={{ color: "var(--pencil)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] uppercase font-bold" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                Book type
              </label>
              {!editingProductNoun && (
                <button
                  onClick={() => setEditingProductNoun(true)}
                  className="text-[10px] font-bold"
                  style={{ color: "var(--teal)" }}
                >
                  Edit
                </button>
              )}
            </div>
            <p className="text-[11px] mb-1.5" style={{ color: "var(--pencil)" }}>
              The word used consistently across generated titles, descriptions, and SEO content.
            </p>
            <input
              type="text"
              spellCheck={true}
              value={productNoun}
              onChange={(e) => setProductNoun(e.target.value)}
              disabled={!editingProductNoun}
              className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-xs disabled:opacity-60"
              style={{ borderColor: "var(--pencil-light)", background: editingProductNoun ? "var(--canvas)" : "var(--paper)" }}
            />
            {editingProductNoun && (
              <div className="flex items-center gap-3 mt-2">
                <button
                  onClick={async () => {
                    await handleSaveProductNoun();
                    setEditingProductNoun(false);
                  }}
                  disabled={savingProductNoun}
                  className="px-3.5 py-1.5 rounded-md text-[11px] font-bold text-white disabled:opacity-60"
                  style={{ background: "var(--teal)" }}
                >
                  {savingProductNoun ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={() => setEditingProductNoun(false)}
                  className="text-[11px] font-medium"
                  style={{ color: "var(--pencil)" }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </PanelSection>

        <PanelSection label="Image settings" open={activeSection === "image"} onToggle={() => toggleSection("image")}>
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Paper size preset
          </label>
          <select
            value={PAPER_PRESETS.find((p) => p.width === canvasWidth && p.height === canvasHeight)?.label ?? "custom"}
            onChange={(e) => e.target.value !== "custom" && applyPreset(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-md border-[1.5px] outline-none text-xs"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          >
            <option value="custom" disabled>
              {PAPER_PRESETS.some((p) => p.width === canvasWidth && p.height === canvasHeight)
                ? "Choose a preset..."
                : "Custom size"}
            </option>
            {PAPER_PRESETS.map((preset) => (
              <option key={preset.label} value={preset.label}>
                {preset.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field label="Canvas width (px)" hint="A4 default is 595" value={canvasWidth} onChange={setCanvasWidth} min={1} />
          <Field label="Canvas height (px)" hint="A4 default is 842" value={canvasHeight} onChange={setCanvasHeight} min={1} />
          <Field
            label="Subject size ratio"
            hint="Fraction of canvas height"
            value={subjectSizeRatio}
            onChange={setSubjectSizeRatio}
            step={0.05}
            min={0.1}
            max={1}
          />
          <Field label="White threshold" hint="Cleanup cutoff" value={whiteThreshold} onChange={setWhiteThreshold} min={0} max={255} />
          <Field label="Black threshold" hint="Cleanup cutoff" value={blackThreshold} onChange={setBlackThreshold} min={0} max={255} />
          <Field label="Palette colors" hint="Smaller = smaller file" value={paletteColors} onChange={setPaletteColors} min={2} max={256} />
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSaveSettings}
            disabled={savingSettings}
            className="px-3.5 py-1.5 rounded-md text-[11px] font-bold text-white disabled:opacity-60"
            style={{ background: imageSettingsDirty ? "var(--coral)" : "var(--teal)" }}
          >
            {savingSettings ? "Saving..." : imageSettingsDirty ? "Save changes" : "Save settings"}
          </button>
          {settingsSaved && (
            <span className="text-[11px] font-medium" style={{ color: "var(--teal)" }}>
              Saved
            </span>
          )}
        </div>
      </PanelSection>

      <PanelSection label="Style knobs" open={activeSection === "knobs"} onToggle={() => toggleSection("knobs")}>
        {book && (
          <KnobsPanel
            bookId={bookId}
            book={book}
            onBookLoaded={(updated) => {
              setBook(updated);
              onBookLoaded?.(updated);
            }}
          />
        )}
      </PanelSection>

      <PanelSection label="Watermark / logo" open={activeSection === "watermark"} onToggle={() => toggleSection("watermark")}>
        <div className="flex items-center gap-3 mb-4">
          <label
            className="px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer border-[1.5px]"
            style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}
          >
            {uploadingWatermark ? "Uploading..." : hasWatermarkFile ? "Replace logo" : "Upload logo"}
            <input type="file" accept="image/*" onChange={handleWatermarkFileChange} className="hidden" />
          </label>
          {hasWatermarkFile && (
            <span className="text-xs" style={{ color: "var(--teal)" }}>
              Logo uploaded
            </span>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs mb-4" style={{ color: "var(--ink)" }}>
          <input
            type="checkbox"
            checked={watermarkEnabled}
            onChange={(e) => setWatermarkEnabled(e.target.checked)}
          />
          Apply watermark to every generated image
        </label>

        {watermarkEnabled && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Position
              </label>
              <div className="flex gap-2 flex-wrap">
                {["bottom-right", "bottom-left", "top-right", "top-left"].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setWatermarkPosition(pos)}
                    className="px-2.5 py-1 rounded-full text-[11px] border-[1.5px]"
                    style={
                      watermarkPosition === pos
                        ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
                        : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                    }
                  >
                    {pos.replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                  Opacity: {Math.round(watermarkOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={watermarkOpacity}
                  onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                  Size: {Math.round(watermarkScale * 100)}%
                </label>
                <input
                  type="range"
                  min={0.05}
                  max={0.35}
                  step={0.01}
                  value={watermarkScale}
                  onChange={(e) => setWatermarkScale(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        <SaveRow onClick={handleSaveWatermark} saving={savingWatermark} saved={watermarkSaved} />
      </PanelSection>
    </Panel>
  );
}
