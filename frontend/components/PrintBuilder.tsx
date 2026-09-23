"use client";

import { useState } from "react";
import { Search, FileText, Sparkles } from "lucide-react";
import AppShell from "./AppShell";
import PublishConnectionsPanel from "./PublishConnectionsPanel";

export default function PrintBuilder() {
  const [exportFormat, setExportFormat] = useState<"PDF" | "SVG" | "Vector">("PDF");
  const [builderSearch, setBuilderSearch] = useState("");

  return (
    <AppShell active="Print" breadcrumb="Print & Publish">
      <div className="flex items-end justify-between gap-5 mb-7">
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            Print production &amp; publishing
          </p>
          <h1
            className="font-display font-normal m-0 mt-2"
            style={{ fontSize: "clamp(34px, 4vw, 47px)", letterSpacing: "-0.045em", color: "var(--ink)" }}
          >
            Print &amp; Publish<span style={{ color: "var(--teal)" }}>.</span>
          </h1>
          <p className="text-[13px] m-0 mt-2.5" style={{ color: "var(--pencil)" }}>
            Build a print-ready collection, and see exactly where your work is already live.
          </p>
        </div>
      </div>

      {/* Cosmetic print-builder section — real PDF/SVG/Vector export is a separate, later project */}
      <div className="rounded-xl overflow-hidden mb-11" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
        <div className="flex items-end justify-between gap-6 p-6" style={{ borderBottom: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
          <div>
            <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
              Build for print
            </p>
            <h2 className="font-display font-normal m-0 mt-1.5" style={{ fontSize: 24, color: "var(--ink)" }}>
              Create book for print
            </h2>
            <p className="text-xs m-0 mt-1.5 max-w-md" style={{ color: "var(--pencil)" }}>
              Assemble pages from your categories, preview the sequence, and prepare the book taxonomy.
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg shrink-0" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
            {(["PDF", "SVG", "Vector"] as const).map((format) => (
              <button
                key={format}
                onClick={() => setExportFormat(format)}
                className="px-2.5 py-1.5 rounded-md text-[10px] font-bold"
                style={
                  exportFormat === format
                    ? { background: "var(--paper)", color: "var(--teal-dark)", boxShadow: "0 2px 7px rgba(32,33,31,0.05)" }
                    : { color: "var(--pencil)" }
                }
              >
                {format}
              </button>
            ))}
          </div>
        </div>

        <div className="grid" style={{ gridTemplateColumns: "minmax(0, 1.15fr) minmax(280px, 0.85fr)" }}>
          <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 400, padding: 28, background: "var(--paper)" }}>
            <div
              className="flex flex-col"
              style={{ width: "min(230px, 65%)", aspectRatio: "8.5/ 11", padding: 15, background: "var(--canvas)", boxShadow: "0 14px 30px rgba(32,33,31,0.14)" }}
            >
              <p className="text-[8px] uppercase font-mono m-0" style={{ color: "var(--pencil)" }}>
                {exportFormat} · 8.5 × 11 in
              </p>
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                <span className="font-display" style={{ fontSize: 34, color: "var(--teal-dark)" }}>+</span>
                <span className="text-[9px]" style={{ color: "var(--pencil)" }}>Add a page to begin</span>
              </div>
              <div className="flex justify-between pt-2.5 text-[8px] font-mono uppercase" style={{ borderTop: "1px solid var(--pencil-light)", color: "var(--pencil)" }}>
                <span>Page 01</span>
                <span>0 pages</span>
              </div>
            </div>
            <button
              disabled
              title="PDF export is coming soon"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white opacity-40 cursor-not-allowed"
              style={{ background: "var(--teal)" }}
            >
              <FileText size={13} /> Build {exportFormat} — coming soon
            </button>
          </div>

          <div style={{ padding: 22, borderLeft: "1px solid var(--pencil-light)" }}>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                  Page source
                </p>
                <h3 className="font-display font-normal m-0 mt-1" style={{ fontSize: 18, color: "var(--ink)" }}>
                  Find artwork
                </h3>
              </div>
              <span className="text-[10px] font-bold" style={{ color: "var(--teal)" }}>0 selected</span>
            </div>
            <div className="flex items-center gap-2 rounded-lg mb-3" style={{ padding: "9px 11px", border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
              <Search size={14} style={{ color: "var(--pencil)" }} />
              <input
                value={builderSearch}
                onChange={(e) => setBuilderSearch(e.target.value)}
                placeholder="Search categories or subjects"
                className="text-xs outline-none flex-1 bg-transparent"
                style={{ color: "var(--ink)" }}
              />
            </div>
            <p className="text-xs text-center py-6" style={{ color: "var(--pencil)" }}>
              Artwork browsing lands with the real PDF engine.
            </p>
            <div className="flex items-center justify-between gap-3 rounded-lg" style={{ padding: 12, border: "1px solid var(--tone-sage)", background: "var(--tone-sage-bg)" }}>
              <div>
                <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--tone-sage)", letterSpacing: "0.1em" }}>
                  Book taxonomy
                </p>
                <p className="text-[10px] m-0 mt-1" style={{ color: "var(--tone-sage)" }}>
                  Set once a print book is started
                </p>
              </div>
              <FileText size={16} style={{ color: "var(--tone-sage)" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg flex items-center gap-3 mb-11" style={{ padding: "13px 15px", border: "1px solid var(--tone-sage)", background: "var(--tone-sage-bg)" }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.6)", color: "var(--tone-sage)" }}>
          <Sparkles size={15} />
        </div>
        <div>
          <p className="font-display font-normal m-0" style={{ fontSize: 14, color: "var(--tone-sage)" }}>
            Print export is on its way
          </p>
          <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--tone-sage)" }}>
            This page shows what&apos;s coming as the print feature is built out.
          </p>
        </div>
      </div>

      <PublishConnectionsPanel />
    </AppShell>
  );
}