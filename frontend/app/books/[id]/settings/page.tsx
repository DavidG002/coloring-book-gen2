"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { getBook, updateBook, ApiError, type Book } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const PAPER_PRESETS: { label: string; width: number; height: number }[] = [
  { label: "A4 (595 × 842)", width: 595, height: 842 },
  { label: "US Letter (612 × 792)", width: 612, height: 792 },
  { label: "A5 (420 × 595)", width: 420, height: 595 },
  { label: "Square (800 × 800)", width: 800, height: 800 },
];

async function checkPreviewAvailability(bookId: number) {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/preview-availability`);
  return res.json() as Promise<{
    available: boolean;
    all_categories: string[];
    eligible_categories: string[];
    sample_subject?: string;
    sample_variation?: string;
    sample_category?: string;
  }>;
}

async function fetchPreviewImage(
  bookId: number,
  settings: {
    canvas_width: number;
    canvas_height: number;
    subject_size_ratio: number;
    white_clean_threshold: number;
    black_clean_threshold: number;
    palette_colors: number;
    category_name: string;
  }
): Promise<Blob> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.detail || "Failed to generate preview");
  }
  return res.blob();
}

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

export default function BookSettingsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookId = parseInt(params.id, 10);

  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [basePrompt, setBasePrompt] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(595);
  const [canvasHeight, setCanvasHeight] = useState(842);
  const [subjectSizeRatio, setSubjectSizeRatio] = useState(0.5);
  const [whiteThreshold, setWhiteThreshold] = useState(245);
  const [blackThreshold, setBlackThreshold] = useState(10);
  const [paletteColors, setPaletteColors] = useState(8);

  const [savingName, setSavingName] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [promptSaved, setPromptSaved] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [previewAvailable, setPreviewAvailable] = useState(false);
  const [eligibleCategories, setEligibleCategories] = useState<string[]>([]);
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [selectedPreviewCategory, setSelectedPreviewCategory] = useState<string>("");
  const [sampleSubject, setSampleSubject] = useState<string | null>(null);
  const [sampleVariation, setSampleVariation] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<"idle" | "confirming" | "loading" | "done">("idle");
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [showFullSize, setShowFullSize] = useState(false);
  const [trueSizeView, setTrueSizeView] = useState(true);

  const viewerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

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
        setCanvasWidth(data.canvas_width);
        setCanvasHeight(data.canvas_height);
        setSubjectSizeRatio(data.subject_size_ratio);
        setWhiteThreshold(data.white_clean_threshold);
        setBlackThreshold(data.black_clean_threshold);
        setPaletteColors(data.palette_colors);

        const availability = await checkPreviewAvailability(bookId);
        if (!cancelled) {
          setPreviewAvailable(availability.available);
          setEligibleCategories(availability.eligible_categories);
          setAllCategories(availability.all_categories);
          setSampleSubject(availability.sample_subject ?? null);
          setSampleVariation(availability.sample_variation ?? null);
          setSelectedPreviewCategory(availability.sample_category ?? "");
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
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save name");
    } finally {
      setSavingName(false);
    }
  }

  async function handleSavePrompt() {
    setError(null);
    const trimmed = basePrompt.trim();
    if (!trimmed) {
      setError("Base prompt cannot be empty.");
      return;
    }
    setSavingPrompt(true);
    try {
      const updated = await updateBook(bookId, { base_prompt: trimmed });
      setBook(updated);
      setPromptSaved(true);
      setTimeout(() => setPromptSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save prompt");
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
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save settings");
    } finally {
      setSavingSettings(false);
    }
  }
  function handleMouseDown(e: React.MouseEvent) {
    if (!viewerRef.current) return;
    setIsDragging(true);
    dragStart.current = {
      x: e.pageX,
      y: e.pageY,
      scrollLeft: viewerRef.current.scrollLeft,
      scrollTop: viewerRef.current.scrollTop,
    };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || !viewerRef.current) return;
    e.preventDefault();
    const dx = e.pageX - dragStart.current.x;
    const dy = e.pageY - dragStart.current.y;
    viewerRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    viewerRef.current.scrollTop = dragStart.current.scrollTop - dy;
  }

  function handleMouseUp() {
    setIsDragging(false);
  }
  async function handleGeneratePreview() {
    setError(null);
    setPreviewState("loading");
    try {
      const blob = await fetchPreviewImage(bookId, {
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        subject_size_ratio: subjectSizeRatio,
        white_clean_threshold: whiteThreshold,
        black_clean_threshold: blackThreshold,
        palette_colors: paletteColors,
        category_name: selectedPreviewCategory,
      });
      if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
      setPreviewImageUrl(URL.createObjectURL(blob));
      setPreviewState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate preview");
      setPreviewState("idle");
    }
  }

  function handleClosePreview() {
    if (previewImageUrl) URL.revokeObjectURL(previewImageUrl);
    setPreviewImageUrl(null);
    setPreviewState("idle");
  }

  function handlePreviewCategoryChange(value: string) {
    setSelectedPreviewCategory(value);
    handleClosePreview();
  }

  if (loading) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
      </main>
    );
  }

  if (!book) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p style={{ color: "var(--coral-dark)" }}>{error ?? "Book not found"}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() => router.push(`/books/${bookId}`)}
          className="text-sm mb-3 inline-block"
          style={{ color: "var(--pencil)" }}
        >
          {"\u2190"} Back to {book.name}
        </button>
        <h1 className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
          Book settings
        </h1>
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
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Book name
            </label>
            <div className="flex items-center gap-3">
              {nameSaved && (
                <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                  Saved
                </span>
              )}
              <button
                onClick={handleSaveName}
                disabled={savingName}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingName ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
        </section>

        <section>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium" style={{ color: "var(--ink)" }}>
              Base prompt
            </label>
            <div className="flex items-center gap-3">
              {promptSaved && (
                <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                  Saved
                </span>
              )}
              <button
                onClick={handleSavePrompt}
                disabled={savingPrompt}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingPrompt ? "Saving..." : "Save prompt"}
              </button>
            </div>
          </div>
          <textarea
            value={basePrompt}
            onChange={(e) => setBasePrompt(e.target.value)}
            rows={8}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
          <p className="mt-1.5 text-xs" style={{ color: "var(--pencil)" }}>
            Shared by every category in this book. Subjects and pose variations are defined per category.
          </p>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold" style={{ color: "var(--ink)" }}>
              Image settings
            </h2>
            <div className="flex items-center gap-3">
              {settingsSaved && (
                <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                  Saved
                </span>
              )}
              <button
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--teal)" }}
              >
                {savingSettings ? "Saving..." : "Save settings"}
              </button>
            </div>
          </div>

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
            </select>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-6">
            <Field label="Canvas width (px)" hint="A4 default is 595" value={canvasWidth} onChange={setCanvasWidth} min={1} />
            <Field label="Canvas height (px)" hint="A4 default is 842" value={canvasHeight} onChange={setCanvasHeight} min={1} />
            <Field
              label="Subject size ratio"
              hint="Fraction of canvas height the subject fills"
              value={subjectSizeRatio}
              onChange={setSubjectSizeRatio}
              step={0.05}
              min={0.1}
              max={1}
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Field label="White threshold" hint="Pixels brighter than this become pure white" value={whiteThreshold} onChange={setWhiteThreshold} min={0} max={255} />
            <Field label="Black threshold" hint="Pixels darker than this become pure black" value={blackThreshold} onChange={setBlackThreshold} min={0} max={255} />
            <Field label="Palette colors" hint="Fewer colors = smaller file size" value={paletteColors} onChange={setPaletteColors} min={2} max={256} />
          </div>
        </section>

        <section
          className="rounded-lg border-[1.5px] p-5"
          style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
        >
          <h2 className="font-display text-base font-semibold mb-3" style={{ color: "var(--ink)" }}>
            Preview settings
          </h2>

          {!previewAvailable ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Add at least one subject and one pose variation to a category in this book to enable a real preview.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                  Preview using category
                </label>
                  <select
                    value={selectedPreviewCategory}
                    onChange={(e) => handlePreviewCategoryChange(e.target.value)}
                    className="w-56 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm capitalize"
                    style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
                  >
                    {allCategories.map((cat) => (
                      <option key={cat} value={cat} className="capitalize">
                        {cat}
                      </option>
                    ))}
                  </select>
                  {eligibleCategories.includes(selectedPreviewCategory) ? (
                    sampleSubject &&
                    selectedPreviewCategory === (allCategories.length > 0 ? selectedPreviewCategory : "") && (
                      <p className="mt-1.5 text-xs" style={{ color: "var(--pencil)" }}>
                        Default sample: {sampleSubject} — {sampleVariation}
                      </p>
                    )
                  ) : (
                    <p className="mt-1.5 text-xs" style={{ color: "var(--coral-dark)" }}>
                      This category has no subject and variation yet — add at least one of each on its own page before previewing.
                    </p>
                  )}
              </div>

              {previewState === "idle" ? (
                <div>
                  <p className="text-sm mb-3" style={{ color: "var(--pencil)" }}>
                    Generates one real test image using your current settings above (unsaved changes included).
                    Costs about $0.007.
                  </p>
                  <button
                    onClick={() => setPreviewState("confirming")}
                    disabled={!eligibleCategories.includes(selectedPreviewCategory)}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: "var(--teal)" }}
                  >
                    Preview settings
                  </button>
                </div>
              ) : previewState === "confirming" ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm" style={{ color: "var(--ink)" }}>
                    Generate a real test image for ~$0.007?
                  </p>
                  <button
                    onClick={handleGeneratePreview}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white"
                    style={{ background: "var(--teal)" }}
                  >
                    Yes, generate
                  </button>
                  <button
                    onClick={() => setPreviewState("idle")}
                    className="px-4 py-2 rounded-md text-sm font-medium"
                    style={{ color: "var(--pencil)" }}
                  >
                    Cancel
                  </button>
                </div>
              ) : previewState === "loading" ? (
                <p className="text-sm" style={{ color: "var(--pencil)" }}>
                  Generating preview...
                </p>
              ) : (
                previewImageUrl && (
                  <div>
                    <img
                      src={previewImageUrl}
                      alt="Settings preview"
                      onClick={() => setShowFullSize(true)}
                      className="max-w-xs rounded-md border-[1.5px] mb-3 cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ borderColor: "var(--pencil-light)" }}
                    />
                    <p className="text-xs mb-3" style={{ color: "var(--pencil)" }}>
                      Click to view at true size ({canvasWidth} × {canvasHeight}px, {(canvasWidth / 72).toFixed(2)}&quot; × {(canvasHeight / 72).toFixed(2)}&quot; at 72 DPI)
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setPreviewState("confirming")}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white"
                        style={{ background: "var(--teal)" }}
                      >
                        Regenerate
                      </button>
                      <button
                        onClick={handleClosePreview}
                        className="px-4 py-2 rounded-md text-sm font-medium"
                        style={{ color: "var(--pencil)" }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )
              )}
            </>
          )}
        </section>
      </div>
        {showFullSize && previewImageUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-8"
            style={{ background: "rgba(28, 27, 26, 0.85)" }}
            onClick={() => setShowFullSize(false)}
          >
            <div
              className="flex flex-col items-center max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                ref={viewerRef}
                onMouseDown={trueSizeView ? handleMouseDown : undefined}
                onMouseMove={trueSizeView ? handleMouseMove : undefined}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="rounded-md shadow-2xl"
                style={{
                  width: "90vw",
                  height: "75vh",
                  overflow: trueSizeView ? "hidden" : "auto",
                  cursor: trueSizeView ? (isDragging ? "grabbing" : "grab") : "default",
                }}
              >
                <img
                  src={previewImageUrl}
                  alt="Settings preview at true size"
                  draggable={false}
                  style={
                    trueSizeView
                      ? { width: `${canvasWidth}px`, height: `${canvasHeight}px`, background: "white", display: "block" }
                      : { width: "100%", height: "100%", objectFit: "contain", background: "white", display: "block" }
                  }
                />
              </div>
              <div className="flex items-center gap-4 mt-4">
                <span className="text-sm" style={{ color: "white" }}>
                  {canvasWidth} × {canvasHeight}px — {(canvasWidth / 72).toFixed(2)}&quot; × {(canvasHeight / 72).toFixed(2)}&quot; at 72 DPI
                </span>
                <button
                  onClick={() => setTrueSizeView((v) => !v)}
                  className="px-4 py-2 rounded-md text-sm font-medium"
                  style={{ background: "var(--teal)", color: "white" }}
                >
                  {trueSizeView ? "Fit to screen" : "True size (scroll)"}
                </button>
                <button
                  onClick={() => setShowFullSize(false)}
                  className="px-4 py-2 rounded-md text-sm font-medium"
                  style={{ background: "var(--canvas)", color: "var(--ink)" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }
