"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Palette, Sparkles, BookOpen, ImageIcon, Layers, SkipForward } from "lucide-react";
import { updateBook, createCategory, updateCategory, ApiError, type Book } from "@/lib/api";
import { PAPER_PRESETS } from "./SettingsUI";
import { FileText } from "lucide-react";

const STEPS = ["Book type", "Creative direction", "Canvas", "First category"];

const BOOK_TYPES = [
  {
    key: "coloring_book",
    label: "Coloring book",
    description: "Black outline line art, no color, no shading — the classic printable coloring page.",
  },
  {
    key: "print_book",
    label: "Print book",
    description: "Full-color, realistic illustration — for prints, cards, or full-color pages.",
  },
  {
    key: "custom",
    label: "Custom",
    description: "Start plain — you'll define the visual rules yourself as you go.",
  },
];

function parseLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export default function NewBookWizard({
  book,
  onFinished,
}: {
  book: Book;
  onFinished: (updated: Book) => void;
}) {
  const [step, setStep] = useState(0);
  const [bookType, setBookType] = useState(book.book_type || "coloring_book");
  const [canvasWidth, setCanvasWidth] = useState(book.canvas_width || 595);
  const [canvasHeight, setCanvasHeight] = useState(book.canvas_height || 842);
  const [subjectSizeRatio, setSubjectSizeRatio] = useState(book.subject_size_ratio || 0.5);
  const [canvasSubStage, setCanvasSubStage] = useState<"shape" | "ratio">("shape");
  const [basePrompt, setBasePrompt] = useState(book.base_prompt || "");
  const [categoryName, setCategoryName] = useState("");
  const [subjectsText, setSubjectsText] = useState("");
  const [variationsText, setVariationsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canContinue = step === 3 ? categoryName.trim().length > 0 : true;

  async function handleFinish() {
    setError(null);
    setSaving(true);
    try {
      const updated = await updateBook(book.id, {
        book_type: bookType,
        canvas_width: canvasWidth,
        canvas_height: canvasHeight,
        subject_size_ratio: subjectSizeRatio,
        base_prompt: basePrompt.trim(),
        wizard_completed: true,
        line_weight_enabled: false,
        detail_density_enabled: false,
        style_tone_enabled: false,
        subject_treatment_enabled: false,
        character_mood_enabled: false,
        background_richness_enabled: false,
        border_style_enabled: false,
      });

      const trimmedCategory = categoryName.trim();
      if (trimmedCategory) {
        const subjects = parseLines(subjectsText);
        const variations = parseLines(variationsText);
        const category = await createCategory({
          name: trimmedCategory.toLowerCase(),
          book_id: book.id,
          subjects: [],
          variations: [],
        });
        if (subjects.length > 0 || variations.length > 0) {
          await updateCategory(category.id, { subjects, variations });
        }
      }

      onFinished(updated);
      window.sessionStorage.setItem(`just-finished-wizard-${book.id}`, "1");
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to finish setup");
      setSaving(false);
    }
  }

  async function handleSkip() {
    setError(null);
    setSaving(true);
    try {
      const updated = await updateBook(book.id, {
        wizard_completed: true,
        line_weight_enabled: false,
        detail_density_enabled: false,
        style_tone_enabled: false,
        subject_treatment_enabled: false,
        character_mood_enabled: false,
        background_richness_enabled: false,
        border_style_enabled: false,
      });
      onFinished(updated);
      window.sessionStorage.setItem(`just-finished-wizard-${book.id}`, "1");
      window.location.reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to skip setup");
      setSaving(false);
    }
  }

  const selectedType = BOOK_TYPES.find((t) => t.key === bookType);

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <header
        className="flex items-center justify-between px-11"
        style={{ height: 70, borderBottom: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
      >
        <Link href="/books" className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--pencil)" }}>
          <ArrowLeft size={16} /> Back to books
        </Link>
        <div className="flex items-center gap-2" style={{ color: "var(--pencil)" }}>
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "var(--teal)", transform: "rotate(-5deg)" }}
          >
            <Palette size={12} color="white" />
          </div>
          <span className="font-display text-sm">{book.name}</span>
        </div>
        <span className="text-[11px]" style={{ color: "var(--pencil)" }}>
          New book setup
        </span>
      </header>

      <div className="mx-auto" style={{ maxWidth: 1120, padding: "54px 6vw 80px" }}>
        <div className="mb-9" style={{ maxWidth: 680 }}>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            A thoughtful beginning
          </p>
          <h1
            className="font-display font-normal m-0 mt-2"
            style={{ fontSize: "clamp(35px, 5vw, 56px)", letterSpacing: "-0.055em", color: "var(--ink)" }}
          >
            Shape &quot;{book.name}&quot;<span style={{ color: "var(--teal)" }}>.</span>
          </h1>
          <p className="text-xs leading-relaxed mt-3" style={{ color: "var(--pencil)" }}>
            Set the foundation now, then refine every page inside your book studio.
          </p>
        </div>

        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-md text-sm"
            style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
          >
            {error}
          </div>
        )}

        <div className="grid" style={{ gridTemplateColumns: "190px minmax(0, 1fr)", gap: 25 }}>
          <aside className="flex flex-col gap-1" style={{ paddingTop: 7 }}>
            <p className="text-[10px] uppercase font-bold mb-2.5 ml-3" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
              Your path
            </p>
            {STEPS.map((label, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <button
                  key={label}
                  onClick={() => i <= step && setStep(i)}
                  disabled={i > step}
                  className="grid items-center text-left rounded-lg"
                  style={{
                    gridTemplateColumns: "25px 1fr",
                    gap: 9,
                    padding: "10px 8px",
                    color: active ? "var(--teal-dark)" : "var(--pencil)",
                    background: active ? "var(--teal-tint)" : "transparent",
                  }}
                >
                  <span
                    className="flex items-center justify-center rounded-full"
                    style={{
                      width: 25,
                      height: 25,
                      fontSize: 9,
                      fontFamily: "ui-monospace, monospace",
                      border: `1px solid ${active || done ? "var(--teal)" : "var(--pencil-light)"}`,
                      background: active || done ? "var(--teal)" : "transparent",
                      color: active || done ? "white" : "var(--pencil)",
                    }}
                  >
                    {done ? <Check size={12} /> : String(i + 1).padStart(2, "0")}
                  </span>
                  <strong className="text-xs font-bold">{label}</strong>
                </button>
              );
            })}
            <div className="flex gap-2 mt-auto pt-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
              <Sparkles size={14} style={{ color: "var(--teal)", flexShrink: 0 }} />
              <p className="text-[10px] leading-relaxed m-0" style={{ color: "var(--pencil)" }}>
                <strong style={{ color: "var(--ink)" }}>Skip anytime.</strong> You can add categories and pages later
                from the book studio.
              </p>
            </div>
          </aside>

          <section
            className="grid overflow-hidden rounded-xl"
            style={{ gridTemplateColumns: "minmax(0, 1fr) 280px", border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
          >
            <div className="flex flex-col" style={{ padding: 28 }}>
              <div className="flex items-center gap-3 mb-9 text-[10px]" style={{ color: "var(--pencil)" }}>
                <span>Step {step + 1} of {STEPS.length}</span>
                <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: "var(--pencil-light)" }}>
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: "var(--teal)", transition: "width 0.25s ease" }}
                  />
                </div>
              </div>

              {step === 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                    Book type
                  </p>
                  <h2 className="font-display font-normal m-0 mt-1.5 mb-2.5" style={{ fontSize: 27, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                    What kind of book is this?
                  </h2>
                  <p className="text-xs leading-relaxed mb-6" style={{ maxWidth: 460, color: "var(--pencil)" }}>
                    This decides the fixed rules every page follows — like whether its black-and-white line art or a
                    full-color illustration.
                  </p>
                  <div className="grid gap-2">
                    {BOOK_TYPES.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setBookType(t.key)}
                        className="flex items-center gap-3 text-left rounded-lg"
                        style={{
                          padding: 14,
                          border: `1.5px solid ${bookType === t.key ? "var(--teal)" : "var(--pencil-light)"}`,
                          background: bookType === t.key ? "var(--teal-tint)" : "transparent",
                        }}
                      >
                        <div className="flex-1">
                          <p className="text-sm font-bold m-0" style={{ color: "var(--ink)" }}>
                            {t.label}
                          </p>
                          <p className="text-[11px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
                            {t.description}
                          </p>
                        </div>
                        {bookType === t.key && <Check size={17} style={{ color: "var(--teal)", flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 1 && (
                <div>
                  <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                    Creative direction
                  </p>
                  <h2 className="font-display font-normal m-0 mt-1.5 mb-2.5" style={{ fontSize: 27, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                    Set the world of this book.
                  </h2>
                  <p className="text-xs leading-relaxed mb-6" style={{ maxWidth: 460, color: "var(--pencil)" }}>
                    A short genre or theme — what this book is about, not how it looks. Style, line weight, and detail
                    are controlled separately, right on the book page.
                  </p>
                  <textarea
                    value={basePrompt}
                    onChange={(e) => setBasePrompt(e.target.value)}
                    spellCheck={true}
                    rows={5}
                    placeholder="e.g. Fun, wholesome coloring pages for kids ages 3 to 10"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
                    style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                  />
                  <div className="flex gap-2 mt-3 rounded-lg" style={{ padding: 12, border: "1px solid #c9ddd2", background: "var(--teal-tint)" }}>
                    <Sparkles size={14} style={{ color: "var(--teal-dark)", flexShrink: 0 }} />
                    <p className="text-[10px] leading-relaxed m-0" style={{ color: "var(--teal-dark)" }}>
                      This can be left blank — you can always add or change it later from the book page.
                    </p>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                    Canvas
                  </p>
                  <h2 className="font-display font-normal m-0 mt-1.5 mb-2.5" style={{ fontSize: 27, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                    Choose your page shape.
                  </h2>
                  <p className="text-xs leading-relaxed mb-6" style={{ maxWidth: 460, color: "var(--pencil)" }}>
                    This sets the proportions for previews and future exports. You can fine-tune it later on the book
                    page.
                  </p>
                  {canvasSubStage === "shape" && (
                  <div className="grid gap-2">
                    {PAPER_PRESETS.map((preset) => {
                      const selected = canvasWidth === preset.width && canvasHeight === preset.height;
                      return (
                        <button
                          key={preset.label}
                          onClick={() => {
                            setCanvasWidth(preset.width);
                            setCanvasHeight(preset.height);
                          }}
                          className="flex items-center gap-3 text-left rounded-lg"
                          style={{
                            padding: 14,
                            border: `1.5px solid ${selected ? "var(--teal)" : "var(--pencil-light)"}`,
                            background: selected ? "var(--teal-tint)" : "transparent",
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                            style={{ background: "var(--teal-tint)", color: "var(--teal)" }}
                          >
                            <FileText size={15} />
                          </div>
                          <p className="text-sm font-bold flex-1 m-0" style={{ color: "var(--ink)" }}>
                            {preset.label}
                          </p>
                          {selected && <Check size={17} style={{ color: "var(--teal)", flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => {
                        setCanvasWidth(0);
                        setCanvasHeight(0);
                      }}
                      className="flex items-center gap-3 text-left rounded-lg"
                      style={{
                        padding: 14,
                        border: `1.5px solid ${canvasWidth === 0 ? "var(--teal)" : "var(--pencil-light)"}`,
                        background: canvasWidth === 0 ? "var(--teal-tint)" : "transparent",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: "var(--teal-tint)", color: "var(--teal)" }}
                      >
                        <FileText size={15} />
                      </div>
                      <p className="text-sm font-bold flex-1 m-0" style={{ color: "var(--ink)" }}>
                        Custom size
                      </p>
                      {canvasWidth === 0 && <Check size={17} style={{ color: "var(--teal)", flexShrink: 0 }} />}
                    </button>
                    {canvasWidth === 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-1">
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                            Width (px)
                          </label>
                          <input
                            type="number"
                            value={canvasWidth || ""}
                            onChange={(e) => setCanvasWidth(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                            style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                            Height (px)
                          </label>
                          <input
                            type="number"
                            value={canvasHeight || ""}
                            onChange={(e) => setCanvasHeight(parseInt(e.target.value, 10) || 0)}
                            className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                            style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  )}

                  {canvasSubStage === "ratio" && (
                    <div>
                      <button
                        onClick={() => setCanvasSubStage("shape")}
                        className="inline-flex items-center gap-1 text-[11px] font-medium mb-4"
                        style={{ color: "var(--pencil)" }}
                      >
                        <ArrowLeft size={12} /> Change page shape
                      </button>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-[10px] font-bold uppercase" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                          Subject size
                        </label>
                        <span className="text-[11px] font-bold" style={{ color: "var(--teal)" }}>
                          {Math.round(subjectSizeRatio * 100)}%
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed mb-4" style={{ color: "var(--pencil)" }}>
                        How much of the page your subject fills, leaving room around it. Watch the live preview on
                        the right.
                      </p>
                      <input
                        type="range"
                        min={0.2}
                        max={0.9}
                        step={0.05}
                        value={subjectSizeRatio}
                        onChange={(e) => setSubjectSizeRatio(parseFloat(e.target.value))}
                        className="w-full"
                        style={{ accentColor: "var(--teal)" }}
                      />
                    </div>
                  )}
                </div>
              )}
              {step === 3 && (
                <div>
                  <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                    First collection
                  </p>
                  <h2 className="font-display font-normal m-0 mt-1.5 mb-2.5" style={{ fontSize: 27, letterSpacing: "-0.03em", color: "var(--ink)" }}>
                    Start with one category.
                  </h2>
                  <p className="text-xs leading-relaxed mb-6" style={{ maxWidth: 460, color: "var(--pencil)" }}>
                    Add a few subjects and pose variations now, or skip and add them later from the category page.
                  </p>
                  <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                    Category name
                  </label>
                  <input
                    type="text"
                    spellCheck={true}
                    value={categoryName}
                    onChange={(e) => setCategoryName(e.target.value)}
                    placeholder="e.g. Animals"
                    autoFocus
                    className="w-full px-3 py-2.5 rounded-md border-[1.5px] outline-none text-sm mb-4"
                    style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                        Subjects
                      </label>
                      <textarea
                        value={subjectsText}
                        onChange={(e) => setSubjectsText(e.target.value)}
                        spellCheck={true}
                        rows={5}
                        placeholder={"Fox\nOwl\nDeer"}
                        className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
                        style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
                        Variations
                      </label>
                      <textarea
                        value={variationsText}
                        onChange={(e) => setVariationsText(e.target.value)}
                        spellCheck={true}
                        rows={5}
                        placeholder={"in a quiet forest\nsleeping curled up"}
                        className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm leading-relaxed"
                        style={{ borderColor: "var(--pencil-light)", background: "var(--paper)" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 mt-auto pt-8">
                <button
                  onClick={handleSkip}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium disabled:opacity-60"
                  style={{ color: "var(--pencil)" }}
                >
                  <SkipForward size={13} /> Skip for now
                </button>
                <div className="flex gap-2">
                  {step > 0 && (
                    <button
                      onClick={() => {
                        if (step === 2 && canvasSubStage === "ratio") {
                          setCanvasSubStage("shape");
                        } else {
                          setStep(step - 1);
                        }
                      }}
                      disabled={saving}
                      className="px-4 py-2.5 rounded-md text-sm font-medium disabled:opacity-60"
                      style={{ color: "var(--pencil)" }}
                    >
                      Back
                    </button>
                  )}
                  {step < STEPS.length - 1 ? (
                    <button
                      onClick={() => {
                        if (step === 2 && canvasSubStage === "shape") {
                          setCanvasSubStage("ratio");
                        } else {
                          setStep(step + 1);
                          if (step === 2) setCanvasSubStage("shape");
                        }
                      }}
                      disabled={(step === 2 && canvasSubStage === "shape" ? canvasWidth === 0 : !canContinue) || saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-40"
                      style={{ background: "var(--teal)" }}
                    >
                      Continue <ArrowRight size={15} />
                    </button>
                  ) : (
                    <button
                      onClick={handleFinish}
                      disabled={!canContinue || saving}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold text-white disabled:opacity-40"
                      style={{ background: "var(--teal)" }}
                    >
                      {saving ? "Setting up..." : "Enter book studio"} <ArrowRight size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <aside className="flex flex-col" style={{ padding: 22, borderLeft: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
              <div className="flex items-center justify-between mb-6">
                <span className="text-[10px] uppercase font-bold" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                  Live preview
                </span>
              </div>
              <div
                className="flex flex-col items-center justify-center text-center rounded-lg mx-auto mb-6 relative"
                style={{
                  width: "min(85%, 170px)",
                  aspectRatio: canvasWidth > 0 && canvasHeight > 0 ? `${canvasWidth} / ${canvasHeight}` : "0.71",
                  border: "1px solid var(--pencil-light)",
                  background: "var(--canvas)",
                  boxShadow: "0 12px 25px rgba(32,33,31,0.11)",
                }}
              >
                {step === 2 ? (
                  <div
                    className="rounded-sm flex items-center justify-center"
                    style={{
                      width: `${subjectSizeRatio * 100}%`,
                      aspectRatio: "1",
                      background: "var(--teal-tint)",
                      border: "1.5px solid var(--teal)",
                    }}
                  >
                    <ImageIcon size={18} style={{ color: "var(--teal)" }} />
                  </div>
                ) : (
                  <>
                    <BookOpen size={26} style={{ color: "var(--teal)" }} />
                    <p className="font-display font-normal mt-2 mb-1 px-3" style={{ fontSize: 14, color: "var(--ink)" }}>
                      {book.name}
                    </p>
                    <p className="text-[9px] px-3" style={{ color: "var(--pencil)" }}>
                      {categoryName || "Add a first category"}
                    </p>
                  </>
                )}
              </div>
              <div className="grid gap-2.5 mt-auto pt-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: "var(--pencil)" }}>
                    <Layers size={12} /> Book type
                  </span>
                  <strong className="text-[10px]" style={{ color: "var(--ink)" }}>
                    {selectedType?.label ?? "—"}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: "var(--pencil)" }}>
                    <FileText size={12} /> Canvas
                  </span>
                  <strong className="text-[10px]" style={{ color: "var(--ink)" }}>
                    {canvasWidth > 0 ? `${canvasWidth} × ${canvasHeight}` : "—"}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: "var(--pencil)" }}>
                    <Sparkles size={12} /> Direction
                  </span>
                  <strong className="text-[10px]" style={{ color: "var(--ink)" }}>
                    {basePrompt.trim() ? "Defined" : "To explore"}
                  </strong>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px]" style={{ color: "var(--pencil)" }}>
                    <ImageIcon size={12} /> Category
                  </span>
                  <strong className="text-[10px] truncate" style={{ color: "var(--ink)", maxWidth: 110 }}>
                    {categoryName || "Not started"}
                  </strong>
                </div>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </div>
  );
}
