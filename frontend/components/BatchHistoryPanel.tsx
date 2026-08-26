"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Image as ImageIcon, Eye, X, ChevronLeft, ChevronRight } from "lucide-react";


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ReviewJob {
  job_id: number;
  created_at: string;
  total_images: number;
  completed_images: number;
}

interface ReviewImage {
  id: number;
  subject: string;
  variation_number: number;
  variation_text: string | null;
  status: string;
  filename: string;
}

async function getJobs(categoryName: string): Promise<ReviewJob[]> {
  const res = await fetch(`${API_BASE_URL}/review/jobs/${encodeURIComponent(categoryName)}`);
  return res.json();
}

async function getJobImages(categoryName: string, jobId: number): Promise<ReviewImage[]> {
  const res = await fetch(`${API_BASE_URL}/review/jobs/${encodeURIComponent(categoryName)}/${jobId}/images`);
  return res.json();
}

function imageFileUrl(imageId: number): string {
  return `${API_BASE_URL}/review/image/${imageId}/file`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function BatchHistoryPanel({ categoryName }: { categoryName: string }) {
  const [open, setOpen] = useState(false);
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [jobImages, setJobImages] = useState<Record<number, ReviewImage[]>>({});
  const [loadingJobId, setLoadingJobId] = useState<number | null>(null);
  const [lightbox, setLightbox] = useState<{ jobId: number; index: number } | null>(null);

  useEffect(() => {
    if (!open || loaded) return;
    const timer = setTimeout(() => {
      setLoading(true);
      getJobs(categoryName)
        .then((data) => setJobs(data.sort((a, b) => b.job_id - a.job_id)))
        .catch(() => {})
        .finally(() => {
          setLoading(false);
          setLoaded(true);
        });
    }, 0);
    return () => clearTimeout(timer);
  }, [open, loaded, categoryName]);

  async function toggleJob(jobId: number) {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
      return;
    }
    setExpandedJobId(jobId);
    if (!jobImages[jobId]) {
      setLoadingJobId(jobId);
      try {
        const images = await getJobImages(categoryName, jobId);
        setJobImages((prev) => ({ ...prev, [jobId]: images }));
      } catch {
        // leave empty on failure
      } finally {
        setLoadingJobId(null);
      }
    }
  }

  return (
    <div className="mx-7 mb-5 rounded-xl overflow-hidden" style={{ border: "1px solid var(--pencil-light)", background: "var(--paper)" }}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between px-4 py-3.5">
        <div className="text-left">
          <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
            Batch history
          </p>
          <p className="font-display font-normal m-0 mt-1" style={{ fontSize: 16, color: "var(--ink)" }}>
            A log of past generation runs for this category
          </p>
        </div>
        <ChevronDown
          size={16}
          style={{ color: "var(--pencil)", transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}
        />
      </button>

      {open && (
        <div style={{ borderTop: "1px solid var(--pencil-light)" }}>
          {loading ? (
            <p className="text-sm px-4 py-4" style={{ color: "var(--pencil)" }}>
              Loading batch history...
            </p>
          ) : jobs.length === 0 ? (
            <p className="text-sm px-4 py-4" style={{ color: "var(--pencil)" }}>
              No past batches yet.
            </p>
          ) : (
            <div>
              {jobs.map((job) => (
                <div key={job.job_id} style={{ borderBottom: "1px solid var(--pencil-light)" }}>
                  <button onClick={() => toggleJob(job.job_id)} className="w-full flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 text-left">
                      <span
                        className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}
                      >
                        <ImageIcon size={13} />
                      </span>
                      <div>
                        <p className="text-xs font-medium m-0" style={{ color: "var(--ink)" }}>
                          Batch #{job.job_id}
                        </p>
                        <p className="text-[10px] m-0 mt-0.5" style={{ color: "var(--pencil)" }}>
                          {formatDateTime(job.created_at)} · {job.completed_images} of {job.total_images} images
                        </p>
                      </div>
                    </div>
                    <ChevronDown
                      size={14}
                      style={{
                        color: "var(--pencil)",
                        transform: expandedJobId === job.job_id ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </button>

                  {expandedJobId === job.job_id && (
                    <div className="px-4 pb-4">
                      {loadingJobId === job.job_id ? (
                        <p className="text-xs" style={{ color: "var(--pencil)" }}>
                          Loading images...
                        </p>
                      ) : (jobImages[job.job_id]?.length ?? 0) === 0 ? (
                        <p className="text-xs" style={{ color: "var(--pencil)" }}>
                          No images recorded for this batch.
                        </p>
                      ) : (
                        <div className="grid gap-1.5 rounded-lg" style={{ padding: "10px 12px", background: "var(--paper)", border: "1px solid var(--pencil-light)" }}>
                          {jobImages[job.job_id].map((img) => {
                            const rejected = img.status === "rejected";
                            return (
                              <div
                                key={img.id}
                                className="flex items-center justify-between gap-3 rounded"
                                style={{
                                  padding: "8px 10px",
                                  background: rejected ? "var(--coral-light)" : "var(--teal-tint)",
                                }}
                              >
                                <div className="min-w-0 flex-1">
                                  <p
                                    className="text-[10px] m-0 truncate"
                                    style={{
                                      fontFamily: "ui-monospace, monospace",
                                      color: rejected ? "var(--coral-dark)" : "var(--teal-dark)",
                                    }}
                                  >
                                    {img.filename}
                                  </p>
                                  <p className="text-[10px] m-0 mt-0.5 capitalize" style={{ color: "var(--pencil)" }}>
                                    {img.subject} — {img.variation_text ?? "no variation recorded"}
                                  </p>
                                </div>
                                {rejected ? (
                                  <span
                                    className="shrink-0 px-2 py-1 rounded text-[9px] font-bold"
                                    style={{ background: "var(--coral)", color: "white" }}
                                  >
                                    Rejected
                                  </span>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const approvedInBatch = jobImages[job.job_id].filter((i) => i.status !== "rejected");
                                        const idx = approvedInBatch.findIndex((i) => i.id === img.id);
                                        setLightbox({ jobId: job.job_id, index: idx });
                                      }}
                                      className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] font-bold"
                                      style={{ border: "1px solid var(--teal)", color: "var(--teal-dark)" }}
                                    >
                                      View <Eye size={10} />
                                    </button>
                                  )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {lightbox &&
        (() => {
          const approvedInBatch = jobImages[lightbox.jobId]?.filter((i) => i.status !== "rejected") ?? [];
          const current = approvedInBatch[lightbox.index];
          if (!current) return null;

          return (
            <div
              className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto"
              style={{ padding: "42px 24px 34px", background: "rgba(248,247,243,0.97)", backdropFilter: "blur(14px)" }}
            >
              <button
                onClick={() => setLightbox(null)}
                className="fixed rounded-full flex items-center justify-center"
                style={{ top: 22, right: 26, width: 36, height: 36, border: "1px solid var(--pencil-light)", background: "var(--canvas)", color: "var(--pencil)" }}
              >
                <X size={20} />
              </button>
              <p className="text-[10px] uppercase font-bold mt-4 mb-4" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
                Batch #{lightbox.jobId} · {lightbox.index + 1} of {approvedInBatch.length}
              </p>
              <div
                className="flex flex-col items-center rounded"
                style={{ width: "min(680px, 100%)", padding: 40, border: "1px solid var(--pencil-light)", background: "var(--canvas)", boxShadow: "0 18px 55px rgba(28,27,26,0.1)" }}
              >
                <img
                  src={imageFileUrl(current.id)}
                  alt={current.subject}
                  style={{ maxWidth: "100%", maxHeight: "50vh", borderRadius: 6 }}
                />
                <h2 className="font-display font-normal mt-5 mb-1 capitalize text-center" style={{ fontSize: 32, letterSpacing: "-0.04em", color: "var(--ink)" }}>
                  {current.subject}
                </h2>
                <p className="text-sm text-center" style={{ color: "var(--pencil)" }}>
                  {current.variation_text ?? "No variation recorded"}
                </p>
              </div>
              <div className="flex gap-2.5 mt-5">
                <button
                  onClick={() => setLightbox((l) => (l ? { ...l, index: (l.index - 1 + approvedInBatch.length) % approvedInBatch.length } : l))}
                  disabled={approvedInBatch.length <= 1}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md text-[11px] font-bold disabled:opacity-30"
                  style={{ border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <button
                  onClick={() => setLightbox((l) => (l ? { ...l, index: (l.index + 1) % approvedInBatch.length } : l))}
                  disabled={approvedInBatch.length <= 1}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md text-[11px] font-bold disabled:opacity-30"
                  style={{ border: "1px solid var(--pencil-light)", color: "var(--teal-dark)" }}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
