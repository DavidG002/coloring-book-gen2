"use client";

import { useState, useEffect, useCallback } from "react";
import { ApiError } from "@/lib/api";
import { components } from "@/lib/api/generated-types";

type ReviewJob = components["schemas"]["ReviewJob"];
type ReviewImage = components["schemas"]["ReviewImage"];

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function listJobs(category: string): Promise<ReviewJob[]> {
  const res = await fetch(`${API_BASE_URL}/review/jobs/${encodeURIComponent(category)}`);
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data;
}

async function listJobImages(category: string, jobId: number): Promise<ReviewImage[]> {
  const res = await fetch(`${API_BASE_URL}/review/jobs/${encodeURIComponent(category)}/${jobId}/images`);
  const data = await res.json();
  if (!res.ok) throw new ApiError(res.status, data.detail);
  return data;
}

async function rejectImage(imageId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/review/image/${imageId}/reject`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
}

async function restoreImage(imageId: number): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/review/image/${imageId}/restore`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
}

function imageFileUrl(imageId: number): string {
  return `${API_BASE_URL}/review/image/${imageId}/file`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ReviewPanel({ categoryName }: { categoryName: string }) {
  const [jobs, setJobs] = useState<ReviewJob[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [images, setImages] = useState<ReviewImage[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<ReviewImage | null>(null);

  const loadJobs = useCallback(() => {
    setLoadingJobs(true);
    listJobs(categoryName)
      .then(setJobs)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load batches"))
      .finally(() => setLoadingJobs(false));
  }, [categoryName]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadJobs();
  }, [loadJobs]);

  function openJob(jobId: number) {
    setSelectedJobId(jobId);
    setError(null);
    setLoadingImages(true);
    listJobImages(categoryName, jobId)
      .then(setImages)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load images"))
      .finally(() => setLoadingImages(false));
  }

  function closeJob() {
    setSelectedJobId(null);
    setImages([]);
  }

  async function handleReject(imageId: number) {
    setBusyImageId(imageId);
    setError(null);
    try {
      await rejectImage(imageId);
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, status: "rejected" } : img)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reject image");
    } finally {
      setBusyImageId(null);
    }
  }

  async function handleRestore(imageId: number) {
    setBusyImageId(imageId);
    setError(null);
    try {
      await restoreImage(imageId);
      setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, status: "approved" } : img)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to restore image");
    } finally {
      setBusyImageId(null);
    }
  }

  const approvedCount = images.filter((i) => i.status === "approved").length;
  const rejectedCount = images.filter((i) => i.status === "rejected").length;

  return (
    <section
      className="rounded-lg border-[1.5px] p-6"
      style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
    >
      <h2 className="font-display text-xl font-semibold mb-4" style={{ color: "var(--ink)" }}>
        Review batches
      </h2>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
      )}

      {!selectedJobId ? (
        loadingJobs ? (
          <p className="text-sm" style={{ color: "var(--pencil)" }}>
            Loading...
          </p>
        ) : jobs.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pencil)" }}>
            No completed generation batches yet.
          </p>
        ) : (
          <div className="space-y-2">
            {jobs.map((job) => (
              <button
                key={job.job_id}
                onClick={() => openJob(job.job_id)}
                className="w-full flex items-center justify-between rounded-md border-[1.5px] px-4 py-3 text-left"
                style={{ borderColor: "var(--pencil-light)" }}
              >
                <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                  {formatDate(job.created_at)}
                </span>
                <span className="text-xs" style={{ color: "var(--pencil)" }}>
                  {job.completed_images} / {job.total_images} images
                </span>
              </button>
            ))}
          </div>
        )
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={closeJob}
              className="text-sm font-medium"
              style={{ color: "var(--pencil)" }}
            >
              {"\u2190"} Back to batches
            </button>
            <span className="text-xs" style={{ color: "var(--pencil)" }}>
              {approvedCount} approved{rejectedCount > 0 ? `, ${rejectedCount} rejected` : ""}
            </span>
          </div>

          {loadingImages ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              Loading images...
            </p>
          ) : images.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--pencil)" }}>
              No images found for this batch.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((img) => (
                <div
                  key={img.id}
                  className="rounded-md border-[1.5px] overflow-hidden"
                  style={{
                    borderColor: img.status === "rejected" ? "var(--coral)" : "var(--pencil-light)",
                    opacity: img.status === "rejected" ? 0.55 : 1,
                  }}
                >
                  <img
                    src={imageFileUrl(img.id)}
                    alt={`${img.subject} v${img.variation_number}`}
                    onClick={() => setExpandedImage(img)}
                    className="w-full aspect-square object-contain bg-white cursor-pointer"
                  />
                  <div className="p-2.5">
                    <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>
                      {img.subject} v{img.variation_number}
                    </p>
                    {img.variation_text && (
                      <p className="text-xs truncate" style={{ color: "var(--pencil)" }}>
                        {img.variation_text}
                      </p>
                    )}
                    {img.status === "approved" ? (
                      <button
                        onClick={() => handleReject(img.id)}
                        disabled={busyImageId === img.id}
                        className="mt-2 w-full py-1.5 rounded text-xs font-medium disabled:opacity-60"
                        style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
                      >
                        {busyImageId === img.id ? "..." : "Reject"}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestore(img.id)}
                        disabled={busyImageId === img.id}
                        className="mt-2 w-full py-1.5 rounded text-xs font-medium text-white disabled:opacity-60"
                        style={{ background: "var(--teal)" }}
                      >
                        {busyImageId === img.id ? "..." : "Restore"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {expandedImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-8"
              style={{ background: "rgba(28, 27, 26, 0.85)" }}
              onClick={() => setExpandedImage(null)}
            >
              <div
                className="max-w-3xl w-full rounded-lg overflow-hidden"
                style={{ background: "var(--canvas)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <img
                  src={imageFileUrl(expandedImage.id)}
                  alt={`${expandedImage.subject} v${expandedImage.variation_number}`}
                  className="w-full max-h-[75vh] object-contain bg-white"
                />
                <div className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                      {expandedImage.subject} v{expandedImage.variation_number}
                    </p>
                    {expandedImage.variation_text && (
                      <p className="text-xs" style={{ color: "var(--pencil)" }}>
                        {expandedImage.variation_text}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {expandedImage.status === "approved" ? (
                      <button
                        onClick={() => {
                          handleReject(expandedImage.id);
                          setExpandedImage(null);
                        }}
                        className="px-4 py-2 rounded-md text-sm font-medium"
                        style={{ color: "var(--coral-dark)", border: "1.5px solid var(--coral)" }}
                      >
                        Reject
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          handleRestore(expandedImage.id);
                          setExpandedImage(null);
                        }}
                        className="px-4 py-2 rounded-md text-sm font-medium text-white"
                        style={{ background: "var(--teal)" }}
                      >
                        Restore
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedImage(null)}
                      className="px-4 py-2 rounded-md text-sm font-medium"
                      style={{ color: "var(--pencil)" }}
                    >
                      Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }