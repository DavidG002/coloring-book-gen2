"use client";

import { forwardRef, useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  complete?: boolean;
}

interface TabbedSectionProps {
  id: string;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  tabs: Tab[];
  savingMessage?: string | null;
}

const TabbedSection = forwardRef<HTMLDivElement, TabbedSectionProps>(
  ({ id, title, isOpen, onToggle, tabs, savingMessage }, ref) => {
    const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");
    const anyComplete = tabs.some((t) => t.complete);

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
              style={{ background: anyComplete ? "var(--teal)" : "var(--pencil-light)" }}
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
          <div className="border-t-[1.5px]" style={{ borderColor: "var(--pencil-light)" }}>
            <div className="flex px-6 pt-3 gap-1" style={{ background: "var(--paper)" }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className="px-4 py-2 text-sm font-medium rounded-t-md relative -mb-[1.5px]"
                  style={
                    activeTab === tab.id
                      ? { background: "var(--canvas)", color: "var(--ink)", border: "1.5px solid var(--pencil-light)", borderBottom: "1.5px solid var(--canvas)" }
                      : { color: "var(--pencil)", border: "1.5px solid transparent" }
                  }
                >
                  <span className="flex items-center gap-1.5">
                    {tab.label}
                    {tab.complete && (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--teal)" }} />
                    )}
                  </span>
                </button>
              ))}
            </div>
            <div className="px-6 pb-6 pt-5" style={{ borderTop: "1.5px solid var(--pencil-light)" }}>
              {tabs.find((t) => t.id === activeTab)?.content}
            </div>
          </div>
        )}
      </div>
    );
  }
);

TabbedSection.displayName = "TabbedSection";
export default TabbedSection;
