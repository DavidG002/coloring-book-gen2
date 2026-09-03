"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import type { components } from "@/lib/api/generated-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type CategoryDeletionInfo = components["schemas"]["CategoryDeletionInfo"];

async function getDeletionInfo(categoryId: number): Promise<CategoryDeletionInfo> {
  const res = await fetch(`${API_BASE_URL}/categories/${categoryId}/deletion-info`);
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
  return res.json();
}

async function deleteCategoryWithFiles(categoryId: number, deleteFiles: boolean): Promise<void> {
  const res = await fetch(
    `${API_BASE_URL}/categories/${categoryId}?delete_files=${deleteFiles}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
}

export default function DeleteCategoryModal({
  categoryId,
  categoryName,
  bookId,
  onClose,
}: {
  categoryId: number;
  categoryName: string;
  bookId: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [info, setInfo] = useState<CategoryDeletionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"remove" | "delete-files" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDeletionInfo(categoryId)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Failed to load deletion info");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  async function handleConfirmDelete() {
    if (!info) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteCategoryWithFiles(categoryId, mode === "delete-files");
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete category");
      setDeleting(false);
    }
  }
  const nameMatches = info ? confirmText.trim().toLowerCase() === info.category_name.toLowerCase() : false;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(28, 27, 26, 0.6)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg p-6 max-h-[85vh] overflow-y-auto"
        style={{ background: "var(--canvas)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg font-semibold mb-1 capitalize" style={{ color: "var(--ink)" }}>
          Delete category
        </h2>

        {loading ? (
          <p className="text-sm" style={{ color: "var(--pencil)" }}>
            Loading...
          </p>
        ) : error && !info ? (
          <p className="text-sm" style={{ color: "var(--coral-dark)" }}>
            {error}
          </p>
        ) : info ? (
          <>
            <p className="text-sm mb-4 capitalize" style={{ color: "var(--pencil)" }}>
              {info.category_name} — {info.image_count} generated image{info.image_count === 1 ? "" : "s"}
              {info.locally_published_count > 0 && `, ${info.locally_published_count} published`}
              {(info.wordpress_draft_count > 0 || info.wordpress_live_count > 0) &&
                `, ${info.wordpress_draft_count + info.wordpress_live_count} on WordPress`}
            </p>

            {info.has_wordpress_content && (
              <div
                className="mb-4 px-3 py-2.5 rounded-md text-xs"
                style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
              >
                This category has content already pushed to WordPress. That content will <strong>not</strong> be
                deleted — remove it manually in wp-admin if needed.
              </div>
            )}

            {error && (
              <div
                className="mb-4 px-3 py-2 rounded-md text-xs"
                style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
              >
                {error}
              </div>
            )}

            {mode === null && (
              <div className="space-y-2">
                <button
                  onClick={() => setMode("remove")}
                  className="w-full text-left px-4 py-3 rounded-md text-sm border-[1.5px]"
                  style={{ borderColor: "var(--pencil-light)" }}
                >
                  <div className="font-medium" style={{ color: "var(--ink)" }}>
                    Remove from app
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--pencil)" }}>
                    Deletes subjects, variations, and translations. Generated files stay on disk, untouched.
                  </div>
                </button>
                <button
                  onClick={() => setMode("delete-files")}
                  className="w-full text-left px-4 py-3 rounded-md text-sm border-[1.5px]"
                  style={{ borderColor: "var(--coral)" }}
                >
                  <div className="font-medium" style={{ color: "var(--coral-dark)" }}>
                    Delete everything, including files
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--pencil)" }}>
                    Also permanently deletes generated images and local publish files. Cannot be undone.
                  </div>
                </button>
                <button
                  onClick={onClose}
                  className="w-full text-center px-4 py-2 rounded-md text-sm mt-2"
                  style={{ color: "var(--pencil)" }}
                >
                  Cancel
                </button>
              </div>
            )}

            {mode === "remove" && (
              <div className="space-y-3">
                <p className="text-sm capitalize" style={{ color: "var(--ink)" }}>
                  Remove &quot;{info.category_name}&quot; from the app? Generated files will remain on disk.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-60"
                    style={{ background: "var(--teal)" }}
                  >
                    {deleting ? "Removing..." : "Remove"}
                  </button>
                  <button
                    onClick={() => setMode(null)}
                    disabled={deleting}
                    className="px-5 py-2 rounded-md text-sm font-medium"
                    style={{ color: "var(--pencil)" }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {mode === "delete-files" && (
              <div className="space-y-3">
                <p className="text-sm font-medium" style={{ color: "var(--coral-dark)" }}>
                  This permanently deletes {info.image_count} generated image{info.image_count === 1 ? "" : "s"} and
                  all related local files. This cannot be undone.
                </p>
                <p className="text-sm capitalize" style={{ color: "var(--ink)" }}>
                  Type <strong>{info.category_name}</strong> to confirm:
                </p>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border-[1.5px] outline-none text-sm"
                  style={{ borderColor: "var(--coral)", background: "var(--canvas)" }}
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleConfirmDelete}
                    disabled={!nameMatches || deleting}
                    className="px-5 py-2 rounded-md text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: "var(--coral)" }}
                  >
                    {deleting ? "Deleting..." : "Permanently delete"}
                  </button>
                  <button
                    onClick={() => {
                      setMode(null);
                      setConfirmText("");
                    }}
                    disabled={deleting}
                    className="px-5 py-2 rounded-md text-sm font-medium"
                    style={{ color: "var(--pencil)" }}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
