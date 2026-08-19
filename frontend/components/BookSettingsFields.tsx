"use client";

import { useState, useEffect } from "react";
import { getBook, updateBook, ApiError, type Book } from "@/lib/api";
import { Card, SaveRow, Field, PAPER_PRESETS, PRODUCT_NOUN_PRESETS } from "./SettingsUI";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getBook(bookId);
        if (cancelled) return;
        setName(data.name);
        setBasePrompt(data.base_prompt);
        setProductNoun(data.product_noun);
        setCanvasWidth(data.canvas_width);
        setCanvasHeight(data.canvas_height);
        setSubjectSizeRatio(data.subject_size_ratio);
        setWhiteThreshold(data.white_clean_threshold);
        setBlackThreshold(data.black_clean_threshold);
        setPaletteColors(data.palette_colors);
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
      setError("Product type cannot be empty.");
      return;
    }
    setSavingProductNoun(true);
    try {
      const updated = await updateBook(bookId, { product_noun: trimmed });
      onBookLoaded?.(updated);
      setProductNounSaved(true);
      setTimeout(() => setProductNounSaved(false), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save product type");
    } finally {
      setSavingProductNoun(false);
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
      onBookLoaded?.(updated);
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
      onBookLoaded?.(updated);
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

  return (
    <div className="space-y-6">
      {error && (
        <div
          className="px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      <Card title="Book name & type" description="How this book appears throughout the app.">
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Book name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
          <SaveRow onClick={handleSaveName} saving={savingName} saved={nameSaved} />
        </div>

        <div className="mt-6 pt-6 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Book type
          </label>
          <p className="text-xs mb-1.5" style={{ color: "var(--pencil)" }}>
            The word used consistently across generated titles, descriptions, and SEO content.
          </p>
          <input
            type="text"
            value={productNoun}
            onChange={(e) => setProductNoun(e.target.value)}
            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          />
          <SaveRow onClick={handleSaveProductNoun} saving={savingProductNoun} saved={productNounSaved} />
        </div>
      </Card>

      <Card
        title="Base prompt"
        description="Shared by every category in this book. Subjects and pose variations are defined per category."
      >
        <textarea
          value={basePrompt}
          onChange={(e) => setBasePrompt(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
          style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
        />
        <SaveRow onClick={handleSavePrompt} saving={savingPrompt} saved={promptSaved} label="Save prompt" />
      </Card>

      <Card
        title="Watermark / logo"
        description="Applied to every generated image — local publish and WordPress pushes included."
      >
        <div className="flex items-center gap-3 mb-4">
          <label
            className="px-4 py-2 rounded-md text-sm font-medium cursor-pointer border-[1.5px]"
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

        <label className="flex items-center gap-2 text-sm mb-4" style={{ color: "var(--ink)" }}>
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
                    className="px-3 py-1.5 rounded-full text-sm border-[1.5px]"
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

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
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
                Size: {Math.round(watermarkScale * 100)}% of page width
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
        )}

        <SaveRow onClick={handleSaveWatermark} saving={savingWatermark} saved={watermarkSaved} />
      </Card>

      <Card title="Image settings" description="Canvas size, subject scale, and cleanup thresholds.">
        <div className="mb-5">
          <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
            Paper size preset
          </label>
          <select
            value={PAPER_PRESETS.find((p) => p.width === canvasWidth && p.height === canvasHeight)?.label ?? "custom"}
            onChange={(e) => e.target.value !== "custom" && applyPreset(e.target.value)}
            className="w-56 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
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

        <SaveRow onClick={handleSaveSettings} saving={savingSettings} saved={settingsSaved} label="Save settings" />
      </Card>
    </div>
  );
}
