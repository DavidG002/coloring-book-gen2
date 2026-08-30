"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Sparkles, CircleCheck, CornerDownRight, BookOpen } from "lucide-react";

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
  children,
}: {
  bookId: number;
  bookName: string;
  categoryName: string;
  hasAnyPairingSelected: boolean;
  wordPressStepAvailable: boolean;
  wordPressSiteLabel: string;
  children: (activeStep: StepId, setActiveStep: (s: StepId) => void) => React.ReactNode;
}) {
  const [activeStep, setActiveStep] = useState<StepId>("generate");
  const mainStepIndex = STEPS.findIndex((s) => s.id === activeStep);
  const stepIndex = activeStep === "wordpress" ? STEPS.length - 1 : mainStepIndex;

  return (
    <div style={{ minHeight: "100vh", background: "var(--paper)" }}>
      <header
        className="flex items-center justify-between px-11"
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
        <div style={{ width: 100 }} />
      </header>

      <main
        className="grid items-start justify-center mx-auto"
        style={{ gridTemplateColumns: "280px minmax(0, 720px)", gap: 72, padding: "58px 6vw 90px" }}
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

        <section className="min-w-0">
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
      </main>
    </div>
  );
}
