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

  // Stage 2 (phone support): the left-rail step list reads fine as a
  // vertical list at desktop/tablet width, but below 640px it's just a tall
  // list of rows sitting above the actual content. Below that width it
  // renders as a horizontal, swipeable tab strip instead — same steps, same
  // state, just laid out for a phone.
  const [isPhoneViewport, setIsPhoneViewport] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsPhoneViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Desktop's two-column layout used to be CSS Grid with the workflow
  // section spanning two rows so auto-placement could drop BookStyleSidebar
  // below the nav (see the old comment this replaced). That row-span coupled
  // the nav column's row height to the section's height: since the section
  // is often much taller than the nav box, the grid distributed extra height
  // into the nav's row, leaving blank space below the nav box that shrank or
  // grew as BookStyleSidebar's own accordions opened/closed (David: "it
  // jumps up and down when expanding... the gap should be fixed"). Flexbox
  // doesn't share height between siblings at all, so switching to it at
  // desktop width removes the coupling entirely. Done at the JS level (like
  // isPhoneViewport above) rather than via CSS classes so BookStyleSidebar —
  // which fetches its own data on mount — only ever renders once.
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktopViewport(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Shared between both nav layouts so the "needs attention" / "pending
  // review" logic exists in exactly one place.
  function stepIndicator(stepId: MainStepId) {
    if (stepId === "generate" && hasAnyPairingSelected) {
      return <CircleCheck size={15} style={{ color: "var(--teal)" }} />;
    }
    if (stepId === "language" && languageNeedsAttention) {
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: "var(--coral)" }}
          title="Some subjects or variations need translation"
        />
      );
    }
    if (stepId === "language" && !languageNeedsAttention && languagePendingReview && languagePendingReview.length > 0) {
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: "var(--tone-blue)" }}
          title="New auto-translated items to review"
        />
      );
    }
    if (stepId === "publish" && publishNeedsAttention) {
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: "var(--coral)" }}
          title="Some pairings still need SEO content"
        />
      );
    }
    if (stepId === "publish" && !publishNeedsAttention && publishPendingReview && publishPendingReview.length > 0) {
      return (
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: "var(--tone-blue)" }}
          title="New auto-generated SEO content to review"
        />
      );
    }
    return null;
  }

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
  
  const navAside = (
    <aside
      className="rounded-2xl border border-[color:var(--nav-panel-border)]"
      style={{ background: "var(--nav-panel)", padding: "var(--nav-panel-padding)" }}
    >
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

      {isPhoneViewport ? (
        <nav className="flex gap-2 overflow-x-auto mt-6 pb-1 -mx-5 px-5" style={{ scrollbarWidth: "none" }}>
          {STEPS.map((step) => {
            const active = activeStep === step.id;
            return (
              <button
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                className="flex items-center gap-1.5 rounded-full text-xs whitespace-nowrap shrink-0"
                style={{
                  padding: "8px 14px",
                  color: active ? "var(--teal-dark)" : "var(--pencil)",
                  background: active ? "var(--teal-tint)" : "var(--canvas)",
                  border: `1px solid ${active ? "var(--teal)" : "var(--pencil-light)"}`,
                  fontWeight: active ? 700 : 500,
                }}
              >
                <span>{step.label}</span>
                {stepIndicator(step.id)}
              </button>
            );
          })}

          {wordPressStepAvailable && (
            <button
              onClick={() => setActiveStep("wordpress")}
              className="flex items-center gap-1.5 rounded-full text-xs whitespace-nowrap shrink-0"
              style={{
                padding: "8px 14px",
                color: activeStep === "wordpress" ? "var(--teal-dark)" : "var(--pencil)",
                background: activeStep === "wordpress" ? "var(--teal-tint)" : "var(--canvas)",
                border: `1px solid ${activeStep === "wordpress" ? "var(--teal)" : "var(--pencil-light)"}`,
                fontWeight: activeStep === "wordpress" ? 700 : 500,
              }}
            >
              <CornerDownRight size={13} style={{ flexShrink: 0 }} />
              <span className="truncate" style={{ maxWidth: 120 }}>{wordPressSiteLabel}</span>
            </button>
          )}
        </nav>
      ) : (
        <nav className="grid gap-1 mt-11">
          {STEPS.map((step) => {
            const active = activeStep === step.id;
            const indicator = stepIndicator(step.id);
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
                {indicator && <span className="ml-auto">{indicator}</span>}
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
      )}

      <div className="flex gap-2 mt-16 pt-4" style={{ borderTop: "1px solid var(--shell-border)" }}>
        <Sparkles size={15} style={{ color: "var(--pencil)", flexShrink: 0 }} />
        <p className="text-[10px] leading-relaxed m-0" style={{ color: "var(--pencil)" }}>
          Thoughtful pairings create more consistent coloring pages.
        </p>
      </div>
    </aside>
  );

  const workflowSection = (
    <section className="min-w-0 flex-1">
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
  );

  const styleSidebar = activeStep === "generate" && (
    <BookStyleSidebar bookId={bookId} categoryName={categoryName} onLiveImageSettingsChange={onLiveImageSettingsChange} />
  );

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
          nav, workflow content, then Book Style last — the order David
          asked for). At lg+, nav and Book Style sit in a fixed 320px flex
          column with a small gap between them (see isDesktopViewport above
          for why this is flexbox rather than a CSS grid row-span). */}
      <main className="px-5 md:px-10 lg:px-[6vw] py-12 lg:py-[58px] lg:pb-[90px]">
        {isDesktopViewport ? (
          <div className="flex items-start gap-x-10 mx-auto" style={{ maxWidth: 1260 }}>
            <div className="flex flex-col gap-12" style={{ width: 320, flexShrink: 0 }}>
              {navAside}
              {styleSidebar}
            </div>
            {workflowSection}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8">
            {navAside}
            {workflowSection}
            {styleSidebar}
          </div>
        )}
      </main>
    </div>
  );
}
