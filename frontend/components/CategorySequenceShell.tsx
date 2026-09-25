"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, CircleCheck, CornerDownRight, BookOpen } from "lucide-react";
import BookStyleSidebar from "./BookStyleSidebar";
import ThemeToggle from "./ThemeToggle";

const STEPS = [
  { id: "generate", label: "Generate", eyebrow: "01" },
  { id: "language", label: "Language", eyebrow: "02" },
  { id: "publish", label: "Publish", eyebrow: "03" },
] as const;

type MainStepId = (typeof STEPS)[number]["id"];
export type StepId = MainStepId | "wordpress";

export default function CategorySequenceShell({
  bookId,
  bookName,
  categoryName,
  hasAnyPairingSelected,
  wordPressStepAvailable,
  wordPressSiteLabel,
  languageNeedsAttention,
  languagePendingReview,
  publishNeedsAttention,
  publishPendingReview,
  onLiveImageSettingsChange,
  initialStep,
  stepRequestKey,
  children,
}: {
  bookId: number;
  bookName: string;
  categoryName: string;
  hasAnyPairingSelected: boolean;
  wordPressStepAvailable: boolean;
  wordPressSiteLabel: string;
  languageNeedsAttention?: boolean;
  languagePendingReview?: string[];
  publishNeedsAttention?: boolean;
  publishPendingReview?: string[];
  // Forwarded into BookStyleSidebar (rendered internally, below) so the
  // Generate step's default-canvas placeholder can track paper size and
  // subject size live, as the sidebar's own sliders move.
  onLiveImageSettingsChange?: (settings: { canvas_width: number; canvas_height: number; subject_size_ratio: number }) => void;
  // A step to land on straight from a deep link (e.g. "?step=wordpress"
  // from the Print & Publish page's connections list), taking priority
  // over whatever step was last saved for this category — a deliberate
  // jump should always win over "where you left off".
  initialStep?: StepId;
  // Changes on every "Publish step"-style deep link click (it carries a
  // cache-busting nonce), even when initialStep itself resolves to the
  // same value as before. Included in the mount effect's dependencies so
  // a repeat click on the same deep link always re-applies it, instead of
  // being a no-op because initialStep "didn't change" while the user had
  // since navigated to a different step inside the workflow.
  stepRequestKey?: string;
  children: (activeStep: StepId, setActiveStep: (s: StepId) => void) => React.ReactNode;
}) {

const [activeStep, setActiveStepRaw] = useState<StepId>(initialStep ?? "generate");
const mainStepIndex = STEPS.findIndex((s) => s.id === activeStep);
const stepIndex = activeStep === "wordpress" ? STEPS.length - 1 : mainStepIndex;

  useEffect(() => {
    if (initialStep) {
      setActiveStepRaw(initialStep);
      window.localStorage.setItem(`category-active-step-${categoryName}`, initialStep);
      return;
    }
    const timer = setTimeout(() => {
      const saved = window.localStorage.getItem(`category-active-step-${categoryName}`);
      if (saved === "generate" || saved === "language" || saved === "publish" || saved === "wordpress") {
        setActiveStepRaw(saved);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [categoryName, initialStep, stepRequestKey]);

  function setActiveStep(step: StepId) {
    setActiveStepRaw(step);
    window.localStorage.setItem(`category-active-step-${categoryName}`, step);
  }
  
  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <header
        className="flex items-center justify-between px-5 md:px-8 lg:px-11"
        style={{ height: 70, borderBottom: "1px solid var(--pencil-light)", background: "var(--canvas)" }}
      >
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2" style={{ color: "var(--pencil)" }}>
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: "var(--teal)", transform: "rotate(-5deg)" }}
              title="Back to overview"
            >
              <BookOpen size={12} color="white" />
            </div>
          </Link>
          <span style={{ width: 1, height: 16, background: "var(--pencil-light)" }} />
          <Link href={`/books/${bookId}`} className="inline-flex items-center gap-2 text-xs" style={{ color: "var(--pencil)" }}>
            <ArrowLeft size={16} /> Back to {bookName}
          </Link>
        </div>
        <div className="text-center">
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            Book studio
          </p>
          <p className="font-display font-normal m-0 mt-0.5 capitalize" style={{ fontSize: 15, color: "var(--ink)" }}>
            {categoryName}
          </p>
        </div>
        <div className="flex justify-end" style={{ width: 100 }}>
          <ThemeToggle />
        </div>
      </header>

      {/* Stage 1 of the responsive pass (see the "responsive-ui-audit" project
          doc): the fixed 280px + 900px two-column layout had no fallback and
          started overlapping below ~1250px of usable width — the single most
          fragile layout in the app, since every category workflow goes
          through this shell. Below lg (1024px) it stacks to one column (step
          nav + style sidebar above, workflow content below) instead. */}
      <main
        className="grid items-start justify-center mx-auto grid-cols-1 lg:grid-cols-[280px_minmax(0,900px)] gap-8 lg:gap-[72px] px-5 md:px-10 lg:px-[6vw] py-12 lg:py-[58px] lg:pb-[90px]"
      >
        <aside>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            Category sequence
          </p>
          <h1
            className="font-display font-normal m-0 mt-2 capitalize"
            style={{ fontSize: 43, letterSpacing: "-0.055em", color: "var(--ink)" }}
          >
            {categoryName}
            <span style={{ color: "var(--teal)" }}>.</span>
          </h1>
          <p className="text-xs leading-relaxed mt-3" style={{ maxWidth: 230, color: "var(--pencil)" }}>
            Match your creative ingredients, generate pages, and publish them to your book.
          </p>

          <nav className="grid gap-1 mt-11">
            {STEPS.map((step) => {
              const active = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  className="flex items-center gap-3 rounded-lg text-left text-xs"
                  style={{
                    padding: "12px 13px",
                    color: active ? "var(--teal-dark)" : "var(--pencil)",
                    background: active ? "var(--teal-tint)" : "transparent",
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  <span className="font-display" style={{ fontSize: 11, color: "var(--pencil)" }}>
                    {step.eyebrow}
                  </span>
                  <span>{step.label}</span>
                  {step.id === "generate" && hasAnyPairingSelected && (
                    <CircleCheck size={15} className="ml-auto" style={{ color: "var(--teal)" }} />
                  )}
                  {step.id === "language" && languageNeedsAttention && (
                    <span
                      className="ml-auto w-2 h-2 rounded-full shrink-0"
                      style={{ background: "var(--coral)" }}
                      title="Some subjects or variations need translation"
                    />
                  )}
                  {step.id === "language" && !languageNeedsAttention && languagePendingReview && languagePendingReview.length > 0 && (
                    <span
                      className="ml-auto w-2 h-2 rounded-full shrink-0"
                      style={{ background: "var(--tone-blue)" }}
                      title="New auto-translated items to review"
                    />
                  )}
                  {step.id === "publish" && publishNeedsAttention && (
                    <span
                      className="ml-auto w-2 h-2 rounded-full shrink-0"
                      style={{ background: "var(--coral)" }}
                      title="Some pairings still need SEO content"
                    />
                  )}
                  {step.id === "publish" && !publishNeedsAttention && publishPendingReview && publishPendingReview.length > 0 && (
                    <span
                      className="ml-auto w-2 h-2 rounded-full shrink-0"
                      style={{ background: "var(--tone-blue)" }}
                      title="New auto-generated SEO content to review"
                    />
                  )}
                </button>
              );
            })}

            {wordPressStepAvailable && (
              <button
                onClick={() => setActiveStep("wordpress")}
                className="flex items-center gap-2 rounded-lg text-left text-xs ml-3"
                style={{
                  padding: "10px 13px",
                  color: activeStep === "wordpress" ? "var(--teal-dark)" : "var(--pencil)",
                  background: activeStep === "wordpress" ? "var(--teal-tint)" : "transparent",
                  fontWeight: activeStep === "wordpress" ? 700 : 400,
                }}
              >
                <CornerDownRight size={13} style={{ flexShrink: 0 }} />
                <span className="truncate">{wordPressSiteLabel}</span>
              </button>
            )}
          </nav>

          <div className="flex gap-2 mt-16 pt-4" style={{ borderTop: "1px solid var(--pencil-light)" }}>
            <Sparkles size={15} style={{ color: "var(--pencil)", flexShrink: 0 }} />
            <p className="text-[10px] leading-relaxed m-0" style={{ color: "var(--pencil)" }}>
              Thoughtful pairings create more consistent coloring pages.
            </p>
          </div>
        </aside>

        {/* lg:row-span-2 makes this the tall right-hand column at desktop
            width, so CSS grid's auto-placement drops the style sidebar below
            (into the newly-freed row 2, column 1) exactly where it used to
            sit inside <aside> — desktop is visually unchanged. Below lg,
            with only one column, grid auto-placement just stacks these three
            siblings in document order: nav, then this content, then the
            style sidebar last — which is the order David asked for (menu,
            then the image panel, then book style/knobs), instead of the
            style sidebar appearing between the menu and the content. */}
        <section className="min-w-0 lg:row-span-2">
          <div className="flex items-center gap-3.5 mb-4 text-[10px]" style={{ color: "var(--pencil)" }}>
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: "var(--pencil-light)" }}>
              <span
                className="block h-full rounded-full"
                style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%`, background: "var(--teal)", transition: "width 0.25s ease" }}
              />
            </div>
          </div>

          {children(activeStep, setActiveStep)}
        </section>

        {activeStep === "generate" && (
          <BookStyleSidebar bookId={bookId} categoryName={categoryName} onLiveImageSettingsChange={onLiveImageSettingsChange} />
        )}
      </main>
    </div>
  );
}
