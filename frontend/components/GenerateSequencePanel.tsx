"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Check, ChevronRight, WandSparkles } from "lucide-react";
import SequencePanel from "./SequencePanel";
import type { Category } from "@/lib/api";
import CategoryImageStrip from "./CategoryImageStrip";
import BatchHistoryPanel from "./BatchHistoryPanel";

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


async function runPairs(category: string, pairs: Pair[]) {
  const res = await fetch(`${API_BASE_URL}/generate/run-pairs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, pairs }),
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

async function getPairCounts(category: string): Promise<Record<string, number>> {
  const res = await fetch(`${API_BASE_URL}/generate/pair-counts/${encodeURIComponent(category)}`);
  const data = await res.json();
  return data.counts ?? {};
}

async function updateCategoryLists(categoryName: string, body: { subjects?: string[]; variations?: string[] }) {
  const res = await fetch(`${API_BASE_URL}/categories/${encodeURIComponent(categoryName)}`, {
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
}: {
  categoryName: string;
  category: Category;
  onCategoryChanged: (updated: Category) => void;
  languageNeedsAttention?: boolean;
  onGoToLanguage?: () => void;
}) {
  
  const [subjects, setSubjects] = useState<string[]>(category.subjects.map((s) => s.name));
  const [variations, setVariations] = useState<string[]>(
    category.variations.sort((a, b) => a.order - b.order).map((v) => v.text)
  );
  const [selectedSubject, setSelectedSubject] = useState<string>(subjects[0] ?? "");
  const [pairs, setPairs] = useState<Pair[]>([]);
  const [pairCounts, setPairCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const [job, setJob] = useState<JobStatus | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [etaLabel, setEtaLabel] = useState<string | null>(null);
  const lastCompletionRef = useRef<{ time: number; count: number } | null>(null);
  const recentPaceRef = useRef<number[]>([]);


  useEffect(() => {
    getPairCounts(categoryName).then(setPairCounts).catch(() => {});
  }, [categoryName]);

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

  async function handleAddSubject() {
    const name = window.prompt("New subject name:");
    if (!name?.trim()) return;
    const next = [...subjects, name.trim()];
    setSubjects(next);
    try {
      const updated = await updateCategoryLists(categoryName, { subjects: next });
      onCategoryChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add subject");
    }
  }

  async function handleAddVariation() {
    const text = window.prompt("New variation:");
    if (!text?.trim()) return;
    const next = [...variations, text.trim()];
    setVariations(next);
    try {
      const updated = await updateCategoryLists(categoryName, { variations: next });
      onCategoryChanged(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add variation");
    }
  }

  async function handleRemoveVariation(variation: string) {
    const next = variations.filter((v) => v !== variation);
    setVariations(next);
    setPairs((prev) => prev.filter((p) => p.variation_text !== variation));
    try {
      const updated = await updateCategoryLists(categoryName, { variations: next });
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
      const result = await runPairs(categoryName, pairs);

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
            getPairCounts(categoryName).then(setPairCounts).catch(() => {});
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

  const remainingPairs = pairs;
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
        <>
          <span className="text-[10px]" style={{ color: "var(--pencil)" }}>
            {pairs.length} images ready
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerate}
              disabled={pairs.length === 0 || generating}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: "var(--teal)", boxShadow: "0 5px 14px rgba(91,124,147,0.14)" }}
            >
              {generating ? "Generating..." : "Generate pages"} <WandSparkles size={14} />
            </button>
            {onGoToLanguage && (
              <button
                onClick={onGoToLanguage}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-bold"
                style={
                  languageNeedsAttention
                    ? { background: "var(--coral)", color: "white" }
                    : { border: "1px solid var(--pencil-light)", color: "var(--pencil)" }
                }
              >
                Language <ChevronRight size={13} />
              </button>
            )}
          </div>
        </>
      }
    >
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

      <CategoryImageStrip categoryName={categoryName} refreshKey={refreshTrigger} />
      <BatchHistoryPanel categoryName={categoryName} refreshKey={refreshTrigger} />

      <div className="grid grid-cols-2" style={{ borderTop: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
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
            <button
              onClick={handleAddSubject}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold"
              style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
            >
              <Plus size={13} /> Add
            </button>
          </div>
          {subjects.map((subject) => {
            const count = pairs.filter((p) => p.subject === subject).length;
            const active = selectedSubject === subject;
            return (
              <button
                key={subject}
                onClick={() => setSelectedSubject(subject)}
                className="w-full flex items-center justify-between mt-1.5 rounded-lg text-left text-xs"
                style={{
                  padding: "11px 10px",
                  border: `1px solid ${active ? "#c9ddd2" : "transparent"}`,
                  color: active ? "var(--teal-dark)" : "var(--ink)",
                  background: active ? "var(--teal-tint)" : "transparent",
                }}
              >
                <span>{subject}</span>
                <span className="inline-flex items-center gap-1 text-[10px]" style={{ color: active ? "var(--teal)" : "var(--pencil)" }}>
                  {count} matched <ChevronRight size={13} />
                </span>
              </button>
            );
          })}
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
                onClick={handleAddVariation}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-bold"
                style={{ border: "1px solid var(--pencil-light)", color: "var(--teal)" }}
              >
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
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

      <div
        className="flex items-center justify-between text-[10px]"
        style={{ padding: "14px 20px", borderTop: "1px solid var(--pencil-light)", color: "var(--pencil)" }}
      >
        <span>
          <strong style={{ color: "var(--teal-dark)", fontSize: 12 }}>{pairs.length}</strong> pairings selected
        </span>
        <span>{pairs.length} images will be generated</span>
      </div>

      <div className="mx-5 mb-5 rounded-lg" style={{ padding: "15px 17px", border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
        <p className="text-[10px] uppercase font-bold m-0 mb-2" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
          Files to be generated
        </p>
        {remainingPairs.length === 0 ? (
          <p className="text-[11px] italic m-0" style={{ color: "var(--pencil)" }}>
            {generating ? "All selected files are being prepared..." : "Select a pairing to preview filenames."}
          </p>
        ) : (
          <div className="grid gap-1.5">
            {remainingPairs.map((pair, i) => (
              <div
                key={`${pair.subject}-${pair.variation_text}`}
                className="flex items-baseline gap-2.5 rounded"
                style={{ padding: "8px 10px", background: "var(--teal-tint)", color: "var(--teal-dark)", fontFamily: "ui-monospace, monospace", fontSize: 10 }}
              >
                <b style={{ minWidth: 18, color: "var(--pencil)", fontSize: 9, fontWeight: 500 }}>
                  {String(i + 1).padStart(2, "0")}
                </b>
                <span>{fileNameFor(pair.subject, pair.variation_text)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </SequencePanel>
  );
}
