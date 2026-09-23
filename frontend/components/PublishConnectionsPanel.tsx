"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe2, ChevronDown, ExternalLink, Link2Off, Radio, CornerDownRight } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TONES = [
  { bg: "var(--tone-sage-bg)", fg: "var(--tone-sage)" },
  { bg: "var(--tone-blue-bg)", fg: "var(--tone-blue)" },
  { bg: "var(--tone-peach-bg)", fg: "var(--tone-peach)" },
  { bg: "var(--tone-yellow-bg)", fg: "var(--tone-yellow)" },
  { bg: "var(--tone-lavender-bg)", fg: "var(--tone-lavender)" },
];

interface OverviewLanguageLink {
  lang: string;
  wp_term_id: number;
  term_link: string | null;
}

interface OverviewCategory {
  category_id: number;
  category_name: string;
  book_id: number;
  book_name: string;
  languages: OverviewLanguageLink[];
}

interface OverviewResponse {
  connected: boolean;
  site_url: string | null;
  site_label: string | null;
  categories: OverviewCategory[];
}

async function getPublishOverview(): Promise<OverviewResponse> {
  const res = await fetch(`${API_BASE_URL}/wordpress/overview`);
  return res.json();
}

export default function PublishConnectionsPanel() {
  const router = useRouter();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      getPublishOverview()
        .then((d) => {
          if (!cancelled) setData(d);
        })
        .catch(() => {
          if (!cancelled) setData({ connected: false, site_url: null, site_label: null, categories: [] });
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  function toggle(categoryId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const totalLivePages = (data?.categories ?? []).reduce(
    (sum, c) => sum + c.languages.filter((l) => l.term_link).length,
    0
  );
  const totalLanguages = new Set((data?.categories ?? []).flatMap((c) => c.languages.map((l) => l.lang))).size;

  return (
    <div className="mb-11">
      <div className="flex items-end justify-between gap-5 mb-5">
        <div>
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.12em" }}>
            Live on the web
          </p>
          <h2 className="font-display font-normal m-0 mt-2" style={{ fontSize: 28, letterSpacing: "-0.03em", color: "var(--ink)" }}>
            Publish<span style={{ color: "var(--teal)" }}>.</span>
          </h2>
          <p className="text-[13px] m-0 mt-1.5 max-w-lg" style={{ color: "var(--pencil)" }}>
            Where each category actually lives once it&apos;s pushed — the real, public page a visitor lands on.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: "var(--pencil)" }}>Loading connections...</p>
      ) : !data?.connected ? (
        <div
          className="rounded-xl flex items-center gap-4"
          style={{ padding: 22, border: "1.5px dashed var(--pencil-light)" }}
        >
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "var(--pencil-light)", color: "var(--pencil)" }}
          >
            <Link2Off size={18} />
          </div>
          <div>
            <p className="font-display font-normal m-0" style={{ fontSize: 15, color: "var(--ink)" }}>
              No publishing destination connected yet
            </p>
            <p className="text-xs m-0 mt-1" style={{ color: "var(--pencil)" }}>
              Connect a site in Account → Integrations to see its live publishing pages here.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--pencil-light)", background: "var(--canvas)" }}>
          {/* Connection summary — the "hub" this whole section radiates from */}
          <div
            className="flex items-center justify-between gap-5 flex-wrap"
            style={{ padding: "18px 22px", background: "var(--tone-blue-bg)", borderBottom: "1px solid var(--pencil-light)" }}
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--canvas)", color: "var(--tone-blue)" }}
              >
                <Globe2 size={19} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <a
                    href={data.site_url ?? "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display font-normal truncate hover:underline"
                    style={{ fontSize: 18, color: "var(--ink)" }}
                  >
                    {data.site_label}
                  </a>
                  <ExternalLink size={12} style={{ color: "var(--tone-blue)" }} className="shrink-0" />
                </div>
                <p className="text-[11px] m-0 mt-0.5" style={{ color: "var(--teal-dark)" }}>
                  WordPress · {data.categories.length} {data.categories.length === 1 ? "category" : "categories"} publishing across {totalLanguages || 0} {totalLanguages === 1 ? "language" : "languages"}
                </p>
              </div>
            </div>
            <div
              className="inline-flex items-center gap-1.5 rounded-full shrink-0"
              style={{ padding: "6px 11px", background: "var(--canvas)", color: "var(--tone-sage)" }}
            >
              <Radio size={11} />
              <span className="text-[10px] font-bold whitespace-nowrap">{totalLivePages} live pages</span>
            </div>
          </div>

          {/* Directory of publishing pages, one row per category */}
          {data.categories.length === 0 ? (
            <p className="text-sm py-8 text-center" style={{ color: "var(--pencil)" }}>
              Nothing published yet — pages will appear here the first time a category goes live.
            </p>
          ) : (
            <div>
              {data.categories.map((cat, i) => {
                const tone = TONES[i % TONES.length];
                const isOpen = expanded.has(cat.category_id);
                const liveCount = cat.languages.filter((l) => l.term_link).length;
                return (
                  <div
                    key={cat.category_id}
                    style={{ borderBottom: i < data.categories.length - 1 ? "1px solid var(--pencil-light)" : undefined }}
                  >
                    <div className="w-full flex items-center gap-3.5" style={{ padding: "14px 22px" }}>
                      <button
                        onClick={() => toggle(cat.category_id)}
                        className="flex-1 min-w-0 flex items-center gap-3.5 text-left"
                      >
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tone.fg }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-display font-normal capitalize m-0 truncate" style={{ fontSize: 14, color: "var(--ink)" }}>
                            {cat.category_name}
                          </p>
                          <p className="text-[10px] m-0 mt-0.5 truncate" style={{ color: "var(--pencil)" }}>
                            {cat.book_name}
                          </p>
                        </div>
                      </button>
                      <span
                        className="px-2 py-1 rounded text-[10px] font-bold whitespace-nowrap shrink-0"
                        style={{ background: tone.bg, color: tone.fg, fontFamily: "ui-monospace, monospace" }}
                      >
                        {liveCount}/{cat.languages.length} live
                      </span>
                      <a
                        href={`/categories/${cat.category_id}?step=wordpress`}
                        onClick={(e) => {
                          // Middle-click / cmd/ctrl-click / etc. open a fresh
                          // tab, which always mounts clean — let the browser
                          // handle those natively. A plain click is
                          // intercepted so we can force this exact deep link
                          // to always win over wherever the user last left
                          // that category's workflow: appending a fresh
                          // nonce each time guarantees the navigation is
                          // treated as new even if Next's router would
                          // otherwise reuse a cached instance of that page
                          // that's still sitting on some other step.
                          if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                          e.preventDefault();
                          router.push(`/categories/${cat.category_id}?step=wordpress&_nonce=${Date.now()}`);
                        }}
                        className="inline-flex items-center gap-1 rounded-md text-[10px] font-bold whitespace-nowrap shrink-0 hover:underline"
                        style={{ padding: "5px 8px", color: "var(--teal-dark)", background: "var(--teal-tint)" }}
                        title={`Open ${cat.category_name}'s WordPress publish step in the app`}
                      >
                        <CornerDownRight size={11} /> Publish step
                      </a>
                      <button onClick={() => toggle(cat.category_id)} className="shrink-0" aria-label={isOpen ? "Collapse" : "Expand"}>
                        <ChevronDown
                          size={15}
                          style={{ color: "var(--pencil)", transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s ease" }}
                        />
                      </button>
                    </div>

                    {isOpen && (
                      <div style={{ padding: "2px 22px 16px 38px", background: "var(--paper)" }}>
                        <div className="space-y-1.5">
                          {[...cat.languages]
                            .sort((a, b) => a.lang.localeCompare(b.lang))
                            .map((l) => (
                              <div
                                key={l.lang}
                                className="flex items-center gap-2.5 rounded-md"
                                style={{ padding: "7px 10px", background: "var(--canvas)", border: "1px solid var(--pencil-light)" }}
                              >
                                <span
                                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0"
                                  style={{ background: tone.bg, color: tone.fg, fontFamily: "ui-monospace, monospace" }}
                                >
                                  {l.lang}
                                </span>
                                {l.term_link ? (
                                  <a
                                    href={l.term_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex-1 min-w-0 truncate text-[11px] hover:underline"
                                    style={{ color: "var(--teal-dark)", fontFamily: "ui-monospace, monospace" }}
                                    title={l.term_link}
                                  >
                                    {l.term_link.replace(/^https?:\/\//, "")}
                                  </a>
                                ) : (
                                  <span className="flex-1 min-w-0 truncate text-[11px]" style={{ color: "var(--pencil)" }}>
                                    Link not available
                                  </span>
                                )}
                                {l.term_link && <ExternalLink size={11} className="shrink-0" style={{ color: "var(--pencil)" }} />}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
