"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CategoryDeletionInfo {
  name: string;
  image_count: number;
  locally_published_count: number;
  wordpress_draft_count: number;
  wordpress_live_count: number;
}

interface DeletionInfo {
  book_name: string;
  categories: CategoryDeletionInfo[];
  total_images: number;
  has_wordpress_content: boolean;
}

async function getDeletionInfo(bookId: number): Promise<DeletionInfo> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}/deletion-info`);
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
  return res.json();
}

async function deleteBookWithFiles(bookId: number, deleteFiles: boolean): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/books/${bookId}?delete_files=${deleteFiles}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new ApiError(res.status, data.detail);
  }
}

export default function DeleteBookModal({ bookId, onClose }: { bookId: number; onClose: () => void }) {
  const router = useRouter();
  const [info, setInfo] = useState<DeletionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"remove" | "delete-files" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getDeletionInfo(bookId)
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
  }, [bookId]);

  async function handleConfirmDelete() {
    if (!info) return;
    setError(null);
    setDeleting(true);
    try {
      await deleteBookWithFiles(bookId, mode === "delete-files");
      router.push("/books");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete book");
      setDeleting(false);
    }
  }

  const nameMatches = info ? confirmText.trim() === info.book_name : false;

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
        <h2 className="font-display text-lg font-semibold mb-1" style={{ color: "var(--ink)" }}>
          Delete book
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
            <p className="text-sm mb-4" style={{ color: "var(--pencil)" }}>
              {info.book_name} — {info.categories.length} categor{info.categories.length === 1 ? "y" : "ies"},{" "}
              {info.total_images} generated image{info.total_images === 1 ? "" : "s"}
            </p>

            {info.categories.length > 0 && (
              <div className="mb-4 rounded-md border-[1.5px] p-3 max-h-40 overflow-y-auto" style={{ borderColor: "var(--pencil-light)" }}>
                {info.categories.map((c) => (
                  <div key={c.name} className="text-xs py-1 flex items-center justify-between">
                    <span className="capitalize font-medium" style={{ color: "var(--ink)" }}>
                      {c.name}
                    </span>
                    <span style={{ color: "var(--pencil)" }}>
                      {c.image_count} images
                      {c.locally_published_count > 0 && `, ${c.locally_published_count} published`}
                      {(c.wordpress_draft_count > 0 || c.wordpress_live_count > 0) &&
                        `, ${c.wordpress_draft_count + c.wordpress_live_count} on WordPress`}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {info.has_wordpress_content && (
              <div
                className="mb-4 px-3 py-2.5 rounded-md text-xs"
                style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
              >
                This book has content already pushed to WordPress. That content will <strong>not</strong> be
                deleted — remove it manually in wp-admin if needed.
              </div>
            )}

            {error && (
              <div
                className="mb-4 px-3 py-2 rounded-md text-xs"
                style={{ background: "#fdf0ee", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
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
                    Deletes categories, subjects, and translations. Generated files stay on disk, untouched.
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
                <p className="text-sm" style={{ color: "var(--ink)" }}>
                  Remove &quot;{info.book_name}&quot; and its categories from the app? Generated files will remain
                  on disk.
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
                  This permanently deletes {info.total_images} generated image
                  {info.total_images === 1 ? "" : "s"} and all related local files. This cannot be undone.
                </p>
                <p className="text-sm" style={{ color: "var(--ink)" }}>
                  Type <strong>{info.book_name}</strong> to confirm:
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
