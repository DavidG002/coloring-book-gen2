"use client";

import { forwardRef } from "react";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  complete?: boolean;
  savingMessage?: string | null;
  children: React.ReactNode;
}

const CollapsibleSection = forwardRef<HTMLDivElement, CollapsibleSectionProps>(
  ({ id, title, isOpen, onToggle, complete, savingMessage, children }, ref) => {
    return (
      <div
        ref={ref}
        id={id}
        className="rounded-lg border-[1.5px] overflow-hidden scroll-mt-6"
        style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
      >
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-6 py-4 text-left"
        >
          <div className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: complete ? "var(--teal)" : "var(--pencil-light)" }}
            />
            <h2 className="font-display text-lg font-semibold" style={{ color: "var(--ink)" }}>
              {title}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {savingMessage && (
              <span className="text-xs font-medium" style={{ color: "var(--teal)" }}>
                {savingMessage}
              </span>
            )}
            <span
              className="text-sm transition-transform"
              style={{ color: "var(--pencil)", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              {"\u25BE"}
            </span>
          </div>
        </button>
        {isOpen && (
          <div className="px-6 pb-6 pt-5 border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
            {children}
          </div>
        )}
      </div>
    );
  }
);

CollapsibleSection.displayName = "CollapsibleSection";
export default CollapsibleSection;
