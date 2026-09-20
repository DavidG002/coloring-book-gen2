"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Check, ChevronRight, WandSparkles, ArrowUp, ArrowDown, Minimize2, Maximize2, X } from "lucide-react";
import SequencePanel from "./SequencePanel";
import type { Category } from "@/lib/api";
import CategoryImageStrip from "./CategoryImageStrip";
import BatchHistoryPanel from "./BatchHistoryPanel";
import EditListModal from "./EditListModal";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Pair {
  subject: string;
  variation_text: string;
}


interface JobStatus {
  job_id: number;
  status: string;
  total_images: number;
  completed_images: number;
  error_message?: string | null;
  current_task?: string | null;
}


async function runPairs(categoryId: number, pairs: Pair[]) {
  const res = await fetch(`${API_BASE_URL}/generate/run-pairs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_id: categoryId, pairs }),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to start generation");
  return res.json() as Promise<{ job_id: number; status: string; total_images: number }>;
}

async function getJobStatus(jobId: number): Promise<JobStatus> {
  const res = await fetch(`${API_BASE_URL}/generate/status/${jobId}`);
  return res.json();
}

async function cancelJob(jobId: number) {
  await fetch(`${API_BASE_URL}/generate/cancel/${jobId}`, { method: "POST" });
}

async function getPairCounts(categoryId: number): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE_URL}/generate/pair-counts/${categoryId}`);
  const data = await res.json();
  return data.counts ?? {};
}

async function updateCategoryLists(categoryId: number, body: { subjects?: string[]; variations?: string[]; variations_subject_id?: number }) {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).detail || "Failed to update category");
  return res.json();
}

function fileNameFor(subject: string, variation: string): string {
  const s = subject.toLowerCase().replaceAll(" ", "_");
  const v = variation.toLowerCase().replaceAll(" ", "-");
  return `${s}_${v}.png`;
}

export default function GenerateSequencePanel({
  categoryName,
  category,
  onCategoryChanged,
  languageNeedsAttention,
  onGoToLanguage,
  publishNeedsAttention,
  onGoToPublish,
  onPublishStatusChanged,
  onBuildPublishSet,
  publishSetImageIds,
  onReviewPublishSet,
  onWarnedImagesIdentified,
}: {
  categoryName: string;
  category: Category;
  onCategoryChanged: (updated: Category) => void;
  languageNeedsAttention?: boolean;
  onGoToLanguage?: () => void;
  publishNeedsAttention?: boolean;
  onGoToPublish?: () => void;
  onPublishStatusChanged?: () => void;
  onBuildPublishSet?: (imageIds: number[]) => void;
  publishSetImageIds?: number[];
  onReviewPublishSet?: () => void;
  onWarnedImagesIdentified?: (imageIds: number[]) => void;
}) {
  
  const [subjects, setSubjects] = useState<string[]>(category.subjects.map((s) => s.name));

  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] ?? "");

  const selectedSubjectId = category.subjects.find((s) => s.name === selectedSubject)?.id;
  const variations = category.variations
    .filter((v) => v.subject_id === selectedSubjectId)
    .sort((a, b) => a.order - b.order)
    .map((v) => v.text);
  const [pairs, setPairs] = useState<Pair[]>([]);

  const pairsLoadedRef = useRef(false);

  useEffect(() => {
    pairsLoadedRef.current = false;
    const timer = setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(`generate-pairs-${category.id}`);
        if (saved) {
          setPairs(JSON.parse(saved));
        }
      } catch {
        // corrupted/old data — ignore, start fresh
      } finally {
        pairsLoadedRef.current = true;
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [category.id]);

  useEffect(() => {
    if (!pairsLoadedRef.current) return;
    window.localStorage.setItem(`generate-pairs-${category.id}`, JSON.stringify(pairs));
  }, [pairs, category.id]);


  const [pairCounts, setPairCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const [job, setJob] = useState<JobStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [etaLabel, setEtaLabel] = useState<string | null>(null);
  const lastCompletionRef = useRef<{ time: number; count: number } | null>(null);
  const recentPaceRef = useRef<number[]>([]);

  const [editModalKind, setEditModalKind] = useState<"subjects" | "variations" | null>(null);
  const [autoTranslateBanner, setAutoTranslateBanner] = useState<{ text: string; tone: "blue" | "coral" } | null>(null);
  const [publishSetNotifications, setPublishSetNotifications] = useState<{ key: string; filename: string; tone: "blocked" | "added" | "warned"; message: string }[]>([]);

  const [selectedImageIds, setSelectedImageIds] = useState<number[]>([]);
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0);

  const [listsExpanded, setListsExpanded] = useState(false);
  const [filesListExpanded, setFilesListExpanded] = useState(false);


  useEffect(() => {
    getPairCounts(category.id).then(setPairCounts).catch(() => {});
  }, [category.id]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function pairKey(subject: string, variation: string) {
    return `${subject}|${variation}`;
  }

  function isPaired(subject: string, variation: string) {
    return pairs.some((p) => p.subject === subject && p.variation_text === variation);
  }

  function togglePair(variation: string) {
    if (isPaired(selectedSubject, variation)) {
      setPairs((prev) => prev.filter((p) => !(p.subject === selectedSubject && p.variation_text === variation)));
    } else {
      setPairs((prev) => [...prev, { subject: selectedSubject, variation_text: variation }]);
    }
  }

  function pairAllForSubject() {
    setPairs((prev) => {
      const withoutSubject = prev.filter((p) => p.subject !== selectedSubject);
      return [...withoutSubject, ...variations.map((v) => ({ subject: selectedSubject, variation_text: v }))];
    });
  }
  function unpairAllForSubject() {
    setPairs((prev) => prev.filter((p) => p.subject !== selectedSubject));
  }

  function handleListSaved(updated: Category) {
    setSubjects(updated.subjects.map((s) => s.name));
    onCategoryChanged(updated);

    const langs = Object.keys(updated.auto_translated ?? {});
    if (langs.length > 0) {
      // Count unique item names across languages (same items get translated
      // into every language, so this reflects genuinely new subjects/
      // variations, not one count per language).
      const uniqueNames = new Set<string>();
      langs.forEach((lang) => {
        updated.auto_translated[lang].subjects.forEach((n) => uniqueNames.add(`s:${n}`));
        updated.auto_translated[lang].variations.forEach((n) => uniqueNames.add(`v:${n}`));
      });
      setAutoTranslateBanner({ text: `${uniqueNames.size} new item${uniqueNames.size === 1 ? "" : "s"} added and automatically translated`, tone: "blue" });
      setTimeout(() => setAutoTranslateBanner(null), 4500);
    }
  }

  async function handleRemoveSubject(subject: string) {
    const next = subjects.filter((s) => s !== subject);
    setSubjects(next);
    setPairs((prev) => prev.filter((p) => p.subject !== subject));
    if (selectedSubject === subject) setSelectedSubject(next[0] ?? "");
    try {
      const updated = await updateCategoryLists(category.id, { subjects: next });
      onCategoryChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove subject");
    }
  }

  async function handleRemoveVariation(variation: string) {
    const next = variations.filter((v) => v !== variation);
    setPairs((prev) => prev.filter((p) => p.variation_text !== variation));
    try {
      const updated = await updateCategoryLists(category.id, { variations: next, variations_subject_id: selectedSubjectId });
      onCategoryChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove variation");
    }
  }

  async function handleGenerate() {
    if (pairs.length === 0) return;
    setError(null);
    setGenerating(true);
    setEtaLabel(null);
    lastCompletionRef.current = { time: Date.now(), count: 0 };
    recentPaceRef.current = [];
    

    try {
      const result = await runPairs(category.id, pairs);

      pollRef.current = setInterval(async () => {
        try {
          const status = await getJobStatus(result.job_id);
          setJob(status);

          if (status.total_images <= 1) {
            setEtaLabel(status.completed_images === 0 ? "Estimating, a few more seconds..." : null);
          } else if (status.completed_images === 0) {
            setEtaLabel("Estimating, a few more seconds...");
          } else if (status.completed_images < status.total_images) {
            const last = lastCompletionRef.current;
            if (last && status.completed_images > last.count) {
              const newlyCompleted = status.completed_images - last.count;
              const secondsSinceLast = (Date.now() - last.time) / 1000;
              const secPerImage = secondsSinceLast / newlyCompleted;

              recentPaceRef.current = [...recentPaceRef.current, secPerImage].slice(-3);
              lastCompletionRef.current = { time: Date.now(), count: status.completed_images };
            }

            if (recentPaceRef.current.length > 0) {
              const avgPace = recentPaceRef.current.reduce((a, b) => a + b, 0) / recentPaceRef.current.length;
              const remaining = status.total_images - status.completed_images;
              const etaSec = Math.max(1, Math.round(avgPace * remaining));
              const mins = Math.floor(etaSec / 60);
              const secs = etaSec % 60;
              setEtaLabel(mins > 0 ? `~${mins}m ${secs}s remaining` : `~${secs}s remaining`);
            } else {
              setEtaLabel("Estimating, a few more seconds...");
            }
          } else {
            setEtaLabel(null);
          }

          if (status.status === "done" || status.status === "failed" || status.status === "cancelled") {
            if (pollRef.current) clearInterval(pollRef.current);
            setGenerating(false);
            setPairs([]);
            setRefreshTrigger((n) => n + 1);
            getPairCounts(category.id).then(setPairCounts).catch(() => {});
            if (status.status === "done") {
              fetch(`${API_BASE_URL}/categories/${category.id}/seo/pending-review-count`)
                .then((r) => r.json())
                .then((data) => {
                  if (data.count > 0) {
                    setAutoTranslateBanner({ text: `${data.count} item${data.count === 1 ? "" : "s"} generated with SEO content ready to review`, tone: "blue" });
                    onPublishStatusChanged?.();
                  }
                })
                .catch(() => {});
            }
          }
        } catch {
          // keep polling; a transient failure shouldn't kill the whole run
        }
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start generation");
      setGenerating(false);
    }
  }

  async function handleCancel() {
    if (job) {
      await cancelJob(job.job_id);
    }
  }

  const [newestFirst, setNewestFirst] = useState(true);
  const remainingPairs = newestFirst ? [...pairs].reverse() : pairs;
  const progressPct = job && job.total_images > 0 ? (job.completed_images / job.total_images) * 100 : 0;

  return (
    <SequencePanel 
      eyebrow="01 / GENERATE"
      title={generating ? "Creating your page set" : "Build your page set"}
      description={
        generating
          ? `${job?.completed_images ?? 0} of ${job?.total_images ?? 0} images generated`
          : "Pair each subject with the variations that fit. You can skip combinations that don't feel right."
      }
      icon={<WandSparkles size={25} className={generating ? "animate-spin" : ""} />}
      headerBorder={!generating}
      footer={
        <div className="flex items-center justify-end w-full">
          {/* Intentionally minimal for now — Generate/Build controls moved up
              into the "Files to be generated" section header. Reserved here
              in case a future action belongs at the very bottom instead. */}
        </div>
      }
    >
      {autoTranslateBanner && (
        <div
          className="mx-6 mt-5 px-4 py-3 rounded-md text-xs flex items-center justify-between gap-3"
          style={
            autoTranslateBanner.tone === "coral"
              ? { background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }
              : { background: "var(--tone-blue-bg)", color: "var(--tone-blue)", border: "1px solid var(--tone-blue)" }
          }
        >
          <span>{autoTranslateBanner.text}</span>
          {onGoToLanguage && (
            <button onClick={onGoToLanguage} className="underline font-bold shrink-0">
              Review
            </button>
          )}
        </div>
      )}
      {languageNeedsAttention && (
        <div
          className="mx-6 mt-5 px-4 py-3 rounded-md text-xs flex items-center justify-between gap-3"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          <span>Some subjects or variations still need translation before they can be published.</span>
          {onGoToLanguage && (
            <button onClick={onGoToLanguage} className="underline font-bold shrink-0">
              Go to Language
            </button>
          )}
        </div>
      )}
      {publishNeedsAttention && (
        <div
          className="mx-6 mt-5 px-4 py-3 rounded-md text-xs flex items-center justify-between gap-3"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          <span>Some generated pairings still need SEO content before they can be published.</span>
          {onGoToPublish && (
            <button onClick={onGoToPublish} className="underline font-bold shrink-0">
              Go to Publish
            </button>
          )}
        </div>
      )}

      {error && (
        <div
          className="mx-6 mt-5 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {generating && job && (
        <div className="px-7 pb-5" style={{ borderBottom: "1px solid var(--pencil-light)" }}>
          <div className="rounded-full overflow-hidden" style={{ height: 7, background: "var(--teal-tint)" }}>
            <span
              className="block h-full rounded-full"
              style={{ width: `${progressPct}%`, background: "var(--teal)", transition: "width 0.55s ease" }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <button onClick={handleCancel} className="text-[10px] font-bold" style={{ color: "var(--coral-dark)" }}>
              Cancel batch
            </button>
            {etaLabel && (
              <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
                {etaLabel}
              </span>
            )}
          </div>
        </div>
      )}

          <CategoryImageStrip categoryId={category.id} categoryName={categoryName} refreshKey={refreshTrigger} onSelectionChanged={setSelectedImageIds} publishSetImageIds={publishSetImageIds} clearSelectionTrigger={clearSelectionTrigger} />
         <div className="flex items-center justify-between gap-3 mx-5 mt-5" style={{ padding: "0 2px" }}>
        <span className="text-[11px]" style={{ color: "var(--pencil)" }}>
          <strong style={{ color: "var(--teal-dark)", fontSize: 12 }}>{pairs.length}</strong> pairings selected — {pairs.length} images will be generated
        </span>
        <div className="flex items-center gap-3 shrink-0">
          {generating && (
            <button onClick={handleCancel} className="text-[10px] font-bold" style={{ color: "var(--coral-dark)" }}>
              Cancel
            </button>
          )}
            {selectedImageIds.length > 0 && onBuildPublishSet && (
              <button
                onClick={async () => {
                  const alreadySent = new Set(publishSetImageIds ?? []);
                  const candidateIds = selectedImageIds.filter((id) => !alreadySent.has(id));
                  const skippedCount = selectedImageIds.length - candidateIds.length;

                  let finalIds = candidateIds;
                  const newRows: { key: string; filename: string; tone: "blocked" | "added" | "warned"; message: string }[] = [];

                  if (candidateIds.length > 0) {
                    try {
                      const [newImagesRes, translationsRes] = await Promise.all([
                        fetch(`${API_BASE_URL}/review/images-by-ids?ids=${candidateIds.join(",")}`).then((r) => r.json()),
                        fetch(`${API_BASE_URL}/categories/${category.id}/translations?active_only=true`).then((r) => r.json()),
                      ]);
                      const langs = translationsRes.map((t: { lang: string }) => t.lang);
                      const imagesById: Record<number, { id: number; filename: string; subject: string; variation_text: string | null }> = {};
                      newImagesRes.forEach((img: { id: number; filename: string; subject: string; variation_text: string | null }) => {
                        imagesById[img.id] = img;
                      });

                      let blockedIds: number[] = [];
                      let warnedIds: number[] = [];
                      if (langs.length > 0) {
                        const imagesPayload = newImagesRes.map((img: { id: number; filename: string; subject: string; variation_text: string | null }) => ({
                          id: img.id,
                          source_path: `output/${category.id}/${img.filename}`,
                          subject: img.subject,
                          variation_text: img.variation_text,
                        }));
                        const checkRes = await fetch(`${API_BASE_URL}/publish/check-fully-published`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ category_id: category.id, images: imagesPayload, langs }),
                        }).then((r) => r.json());
                        blockedIds = checkRes.exact_file_blocked ?? [];
                        warnedIds = checkRes.pairing_warning ?? [];
                      }

                      finalIds = candidateIds.filter((id) => !blockedIds.includes(id));

                      for (const id of candidateIds) {
                        const img = imagesById[id];
                        if (!img) continue;
                        const key = `${id}-${Date.now()}`;
                        const label = `${img.subject}${img.variation_text ? ` — ${img.variation_text}` : ""}`;
                        if (blockedIds.includes(id)) {
                          newRows.push({ key, filename: label, tone: "blocked", message: "Already published in every language — skipped" });
                        } else if (warnedIds.includes(id)) {
                          newRows.push({ key, filename: label, tone: "warned", message: "Added — this match already has published content, consider updating SEO" });
                        } else {
                          newRows.push({ key, filename: label, tone: "added", message: "Added to your Publish set" });
                        }
                      }

                      if (warnedIds.length > 0) {
                        onWarnedImagesIdentified?.(warnedIds.filter((id) => finalIds.includes(id)));
                      }
                    } catch {
                      // best-effort — never block adding over a failed check
                    }
                  }

                  setPublishSetNotifications((prev) => [...newRows, ...prev]);

                  if (skippedCount > 0) {
                    setAutoTranslateBanner({
                      text: `${skippedCount} image${skippedCount === 1 ? "" : "s"} already in your Publish set`,
                      tone: "coral",
                    });
                    setTimeout(() => setAutoTranslateBanner(null), 4500);
                  }
                  if (finalIds.length > 0) onBuildPublishSet(finalIds);
                  setClearSelectionTrigger((n) => n + 1);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: "var(--tone-lavender)", boxShadow: "0 5px 14px rgba(129,113,142,0.18)" }}
              >
                Add to Publish set ({selectedImageIds.length})
              </button>
            )}
            {(publishSetImageIds?.length ?? 0) > 0 && onReviewPublishSet && (
              <button
                onClick={onReviewPublishSet}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold"
                style={{ border: "1.5px solid var(--tone-lavender)", color: "var(--tone-lavender)" }}
              >
                Review Publish set ({publishSetImageIds?.length})
              </button>
            )}
          <button
            onClick={handleGenerate}
            disabled={pairs.length === 0 || generating}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
            style={{ background: "var(--teal)", boxShadow: "0 5px 14px rgba(91,124,147,0.14)" }}
          >
            {generating ? "Generating..." : "Generate pages"} <WandSparkles size={14} />
          </button>
        </div>
      </div>
      {publishSetNotifications.length > 0 && (
        <div className="mx-5 mt-3 grid gap-1.5">
          {publishSetNotifications.map((n) => (
            <div
              key={n.key}
              className="flex items-start gap-2.5 rounded"
              style={{
                padding: "8px 10px",
                background: n.tone === "blocked" ? "var(--coral-light)" : n.tone === "warned" ? "#fdf3e2" : "var(--tone-lavender-bg)",
                color: n.tone === "blocked" ? "var(--coral-dark)" : n.tone === "warned" ? "#9c6f1f" : "var(--tone-lavender)",
              }}
            >
              <div className="flex-1 min-w-0">
                <p className="m-0 truncate" style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>
                  {n.filename}
                </p>
                <p className="m-0 mt-0.5" style={{ fontSize: 10 }}>
                  {n.message}
                </p>
              </div>
              <button
                onClick={() => setPublishSetNotifications((prev) => prev.filter((row) => row.key !== n.key))}
                className="shrink-0"
                style={{ color: "inherit", opacity: 0.7 }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="mx-5 mt-3 mb-5 rounded-lg" style={{ padding: "15px 17px", border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
        <div className="flex items-center justify-between mb-3.5">
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
            Files to be generated
          </p>
          <button
            onClick={() => setNewestFirst((v) => !v)}
            className="w-5 h-5 flex items-center justify-center rounded"
            style={{ color: "var(--pencil)" }}
            title={newestFirst ? "Newest on top" : "Oldest on top"}
          >
            {newestFirst ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          </button>
        </div>
        {remainingPairs.length === 0 ? (
          <p className="text-[11px] italic m-0" style={{ color: "var(--pencil)" }}>
            {generating ? "All selected files are being prepared..." : "Select a pairing to preview filenames."}
          </p>
        ) : (
            <div className="grid gap-1.5 overflow-y-auto pr-1" style={{ height: filesListExpanded ? 216 : 108, alignContent: "start", transition: "height 0.2s ease" }}>
            {remainingPairs.map((pair, i) => (
              <div
                key={`${pair.subject}-${pair.variation_text}`}
                className="flex items-baseline gap-2.5 rounded"
                style={{ padding: "6px 10px", background: "var(--teal-tint)", color: "var(--teal-dark)", fontFamily: "ui-monospace, monospace", fontSize: 10 }}
              >
                <b style={{ minWidth: 18, color: "var(--pencil)", fontSize: 9, fontWeight: 500 }}>
                  {String(i + 1).padStart(2, "0")}
                </b>
                <span className="truncate">{fileNameFor(pair.subject, pair.variation_text)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-3">
          <button
            onClick={() => setFilesListExpanded((v) => !v)}
            className="w-5 h-5 flex items-center justify-center rounded"
            style={{ color: "var(--pencil)" }}
            title={filesListExpanded ? "Collapse" : "Expand"}
          >
            {filesListExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

            <div className="grid relative" style={{ gridTemplateColumns: "minmax(320px, 0.8fr) 1.6fr", borderTop: "1px solid var(--pencil-light)", background: "#eef2f5cd" }}>
         <div
          className="absolute flex items-center justify-center"
          style={{ gridColumn: "1 / 2", justifySelf: "end", bottom: -13, width: 26, height: 26, position: "absolute", right: -13 }}
        >
          <button
            onClick={() => setListsExpanded((v) => !v)}
            className="flex items-center justify-center rounded-full w-full h-full"
            style={{
              background: "var(--canvas)",
              border: "1px solid var(--pencil-light)",
              color: "var(--pencil)",
              zIndex: 10,
              boxShadow: "0 2px 6px rgba(28,27,26,0.12)",
            }}
            title={listsExpanded ? "Collapse" : "Expand"}
          >
            {listsExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
        <div style={{ padding: 20, borderRight: "1px solid var(--pencil-light)" }}>
          <div className="flex items-start justify-between mb-3.5">
            <div>
              <h3 className="font-display font-normal m-0" style={{ fontSize: 19, color: "var(--ink)" }}>
                Subjects
              </h3>
              <p className="text-[10px] m-0 mt-1" style={{ color: "var(--pencil)" }}>
                {subjects.length} available
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setEditModalKind("subjects")}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
          <div className="overflow-y-auto pr-1" style={{ maxHeight: listsExpanded ? 520 : 260, transition: "max-height 0.2s ease" }}>
          {subjects.map((subject) => {
            const count = pairs.filter((p) => p.subject === subject).length;
            const active = selectedSubject === subject;
            return (
              <div
                key={subject}
                className="flex items-center gap-1.5 mt-1.5 rounded-lg"
                style={{
                  border: `1px solid ${active ? "#c9ddd2" : "transparent"}`,
                  background: active ? "var(--teal-tint)" : "transparent",
                }}
              >
                <button
                  onClick={() => handleRemoveSubject(subject)}
                  className="shrink-0 flex items-center justify-center"
                  style={{ width: 28, height: 28, marginLeft: 6, color: "var(--pencil)" }}
                  title={`Remove ${subject}`}
                >
                  <Trash2 size={13} />
                </button>
                <button
                  onClick={() => setSelectedSubject(subject)}
                  className="flex-1 flex items-center justify-between text-left text-xs"
                  style={{
                    padding: "11px 10px 11px 0",
                    color: active ? "var(--teal-dark)" : "var(--ink)",
                  }}
                >
                  <span>{subject}</span>
                  <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: active ? "var(--teal)" : "var(--pencil)" }}>
                    {count} matched <ChevronRight size={13} />
                  </span>
                </button>
              </div>
            );
          })}
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <div className="flex items-start justify-between mb-3.5">
            <div>
              <h3 className="font-display font-normal m-0" style={{ fontSize: 19, color: "var(--ink)" }}>
                Variations
              </h3>
              <p className="text-[10px] m-0 mt-1 capitalize" style={{ color: "var(--pencil)" }}>
                For {selectedSubject || "—"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={pairAllForSubject}
                className="px-2 py-1.5 rounded-md text-[10px] font-bold"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
              >
                Pair all
              </button>
              <button
                onClick={unpairAllForSubject}
                className="px-2 py-1.5 rounded-md text-[10px] font-bold"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--coral-dark)" }}
              >
                Unpair all
              </button>
              <button
                onClick={() => setEditModalKind("variations")}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
          <div className="overflow-y-auto pr-1" style={{ maxHeight: listsExpanded ? 520 : 260, transition: "max-height 0.2s ease" }}>
          {variations.map((variation) => {
            const paired = isPaired(selectedSubject, variation);
            const count = pairCounts[pairKey(selectedSubject, variation)] ?? 0;
            return (
              <div
                key={variation}
                className="flex items-center gap-2.5 py-2.5 text-xs"
                style={{ borderBottom: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
              >
                <button
                  onClick={() => togglePair(variation)}
                  className="w-[19px] h-[19px] flex items-center justify-center rounded shrink-0"
                  style={{
                    border: `1px solid ${paired ? "var(--teal)" : "var(--pencil-light)"}`,
                    background: paired ? "var(--teal)" : "var(--canvas)",
                    color: "white",
                  }}
                >
                  {paired && <Check size={12} />}
                </button>
                <span className="flex-1 cursor-pointer" onClick={() => togglePair(variation)}>
                  {variation}
                </span>
                {count > 0 && (
                  <span className="text-[10px] shrink-0" style={{ color: "var(--teal)" }}>
                    {count} generated
                  </span>
                )}
                <button
                  onClick={() => handleRemoveVariation(variation)}
                  className="shrink-0"
                  style={{ color: "var(--pencil)", padding: 3 }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
          </div>
        </div>
      </div>
        <div style={{ height: 20 }} />
        <BatchHistoryPanel categoryName={categoryName} refreshKey={refreshTrigger} />
      {editModalKind && (
        <EditListModal
          categoryId={category.id}
          kind={editModalKind}
          currentItems={editModalKind === "subjects" ? subjects : variations}
          onClose={() => setEditModalKind(null)}
          onSaved={handleListSaved}
          variationsSubjectId={selectedSubjectId}
        />
      )}
    </SequencePanel>
  );
}
