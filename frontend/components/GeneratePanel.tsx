"use client";

import { useState, useRef, useEffect } from "react";
import {
  planGeneration,
  runGeneration,
  getGenerationStatus,
  cancelGeneration,
  ApiError,
  type Subject,
  type GenerationPlanResponse,
  type GenerationStatusResponse,
} from "@/lib/api";

type PanelState = "idle" | "planning" | "planned" | "running" | "finished";

export default function GeneratePanel({
  categoryName,
  subjects,
}: {
  categoryName: string;
  subjects: Subject[];
}) {
  const subjectsKey = subjects.map((s) => s.name).join(",");

  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(
    new Set(subjects.map((s) => s.name))
  );
  const [prevSubjectsKey, setPrevSubjectsKey] = useState(subjectsKey);

  // "Adjusting state during render" pattern (React's recommended fix for
  // syncing state to a prop change) instead of useEffect + setState, which
  // triggers an extra render pass. This runs during render, and React bails
  // out of re-rendering children again if nothing further changes.
  if (subjectsKey !== prevSubjectsKey) {
    setPrevSubjectsKey(subjectsKey);
    setSelectedSubjects(new Set(subjects.map((s) => s.name)));
  }

  const [variationsPerSubject, setVariationsPerSubject] = useState(1);
  const [maxImages, setMaxImages] = useState<string>("");

  const [panelState, setPanelState] = useState<PanelState>("idle");
  const [plan, setPlan] = useState<GenerationPlanResponse | null>(null);
  const [status, setStatus] = useState<GenerationStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelRequested, setCancelRequested] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function toggleSubject(name: string) {
    const next = new Set(selectedSubjects);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelectedSubjects(next);
  }

  function buildRequest() {
    const parsedMax = maxImages.trim() ? parseInt(maxImages, 10) : undefined;
    return {
      category: categoryName,
      subjects: Array.from(selectedSubjects),
      new_variations_per_subject: variationsPerSubject,
      max_images: parsedMax,
    };
  }

  async function handlePreview() {
    setError(null);
    if (selectedSubjects.size === 0) {
      setError("Select at least one subject.");
      return;
    }
    setPanelState("planning");
    try {
      const result = await planGeneration(buildRequest());
      setPlan(result);
      setPanelState("planned");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to plan generation");
      setPanelState("idle");
    }
  }

  async function handleConfirmRun() {
    setError(null);
    setCancelRequested(false);
    try {
      const result = await runGeneration(buildRequest());
      setStatus({
        job_id: result.job_id,
        status: "pending",
        total_images: result.total_images,
        completed_images: 0,
        error_message: null,
        current_task: null,
      });
      setPanelState("running");
      startPolling(result.job_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start generation");
    }
  }

  function startPolling(jobId: number) {
    pollRef.current = setInterval(async () => {
      try {
        const s = await getGenerationStatus(jobId);
        setStatus(s);
        if (s.status === "done" || s.status === "failed" || s.status === "cancelled") {
          if (pollRef.current) clearInterval(pollRef.current);
          setPanelState("finished");
        }
      } catch {
        // transient poll failure, try again on next tick
      }
    }, 2000);
  }

  async function handleCancel() {
    if (!status) return;
    setCancelRequested(true);
    try {
      await cancelGeneration(status.job_id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel");
      setCancelRequested(false); // only reset on failure — otherwise the poll loop clears it naturally
    }
  }

  function handleReset() {
    setPanelState("idle");
    setPlan(null);
    setStatus(null);
    setError(null);
    setCancelRequested(false);
  }

  const progressPercent =
    status && status.total_images > 0
      ? Math.round((status.completed_images / status.total_images) * 100)
      : 0;

  return (
    <section
      className="rounded-lg border-[1.5px] p-6"
      style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
    >
      <h2 className="font-display text-xl font-semibold mb-4" style={{ color: "var(--ink)" }}>
        Generate images
      </h2>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {(panelState === "idle" || panelState === "planning") && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--ink)" }}>
              Subjects to include
            </label>
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => {
                const active = selectedSubjects.has(s.name);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSubject(s.name)}
                    className="px-3 py-1.5 rounded-full text-sm border-[1.5px]"
                    style={
                      active
                        ? { background: "var(--teal)", borderColor: "var(--teal)", color: "white" }
                        : { borderColor: "var(--pencil-light)", color: "var(--pencil)" }
                    }
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-6">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                New variations per subject
              </label>
              <input
                type="number"
                min={1}
                value={variationsPerSubject}
                onChange={(e) => setVariationsPerSubject(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-28 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--ink)" }}>
                Max images (optional)
              </label>
              <input
                type="number"
                min={1}
                placeholder="No limit"
                value={maxImages}
                onChange={(e) => setMaxImages(e.target.value)}
                className="w-28 px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
              />
            </div>
          </div>

          <button
            onClick={handlePreview}
            disabled={panelState === "planning"}
            className="px-5 py-2.5 rounded-md text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "var(--teal)" }}
          >
            {panelState === "planning" ? "Planning..." : "Preview batch"}
          </button>
        </div>
      )}

      {panelState === "planned" && plan && (
        <div className="space-y-4">
          <div
            className="rounded-md border-[1.5px] p-4"
            style={{ borderColor: "var(--pencil-light)" }}
          >
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {plan.total_images} image{plan.total_images === 1 ? "" : "s"} planned
              </p>
              <p className="text-sm font-semibold" style={{ color: "var(--coral-dark)" }}>
                Est. cost: ${plan.estimated_cost_usd.toFixed(4)}
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {plan.tasks.map((task, i) => (
                <div key={i} className="text-xs flex gap-2" style={{ color: "var(--pencil)" }}>
                  <span className="font-medium" style={{ color: "var(--ink)" }}>
                    {task.subject} v{task.variation_number}
                  </span>
                  <span>{task.variation_text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleConfirmRun}
              className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
              style={{ background: "var(--teal)" }}
            >
              Confirm & generate
            </button>
            <button
              onClick={handleReset}
              className="px-5 py-2.5 rounded-md text-sm font-medium"
              style={{ color: "var(--pencil)" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {(panelState === "running" || panelState === "finished") && status && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5 text-sm">
              <span style={{ color: "var(--ink)" }}>
                {status.completed_images} / {status.total_images} images
              </span>
              <span
                className="font-medium capitalize"
                style={{
                  color:
                    status.status === "failed"
                      ? "var(--coral-dark)"
                      : status.status === "done"
                      ? "var(--teal)"
                      : cancelRequested
                      ? "var(--coral-dark)"
                      : "var(--pencil)",
                }}
              >
                {cancelRequested && status.status === "running" ? "Cancelling..." : status.status}
              </span>
            </div>
            <div
              className="w-full h-2.5 rounded-full overflow-hidden"
              style={{ background: "var(--paper)", border: "1px solid var(--pencil-light)" }}
            >
              <div
                className="h-full transition-all"
                style={{ width: `${progressPercent}%`, background: "var(--teal)" }}
              />
            </div>
            {status.current_task && (
              <p className="mt-1.5 text-xs" style={{ color: "var(--pencil)" }}>
                Last completed: {status.current_task}
              </p>
            )}
          </div>

          {status.status === "failed" && status.error_message && (
            <p className="text-sm" style={{ color: "var(--coral-dark)" }}>
              {status.error_message}
            </p>
          )}

          <div className="flex gap-3">
            {panelState === "running" && (
              <button
                onClick={handleCancel}
                disabled={cancelRequested}
                className="px-5 py-2.5 rounded-md text-sm font-medium disabled:opacity-60"
                style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
              >
                {cancelRequested ? "Cancelling..." : "Cancel batch"}
              </button>
            )}
            {panelState === "finished" && (
              <button
                onClick={handleReset}
                className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
                style={{ background: "var(--teal)" }}
              >
                Run another batch
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}