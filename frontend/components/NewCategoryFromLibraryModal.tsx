"use client";

import { useState } from "react";
import { X, ArrowUpRight, Sparkles } from "lucide-react";
import NewCategoryModal from "./NewCategoryModal";
import type { BookSummary } from "@/lib/api";

export default function NewCategoryFromLibraryModal({
  books,
  onClose,
}: {
  books: BookSummary[];
  onClose: () => void;
}) {
  const [selectedBookId, setSelectedBookId] = useState<number | "">(books[0]?.id ?? "");
  const [confirmed, setConfirmed] = useState(false);

  const selectedBook = books.find((b) => b.id === selectedBookId);

  if (confirmed && selectedBook) {
    return <NewCategoryModal bookId={selectedBook.id} bookName={selectedBook.name} onClose={onClose} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-5" style={{ background: "rgba(28,27,26,0.5)" }} onClick={onClose}>
      <div
        className="relative rounded-xl p-7"
        style={{ width: "min(420px, 100%)", background: "var(--canvas)", border: "1px solid var(--pencil-light)", boxShadow: "0 20px 60px rgba(28,27,26,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4" style={{ color: "var(--pencil)" }}>
          <X size={18} />
        </button>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4" style={{ background: "var(--teal-tint)", color: "var(--teal-dark)" }}>
          <Sparkles size={16} />
        </div>
        <p className="text-[10px] uppercase font-bold m-0" style={{ color: "var(--pencil)", letterSpacing: "0.1em" }}>
          A new collection
        </p>
        <h2 className="font-display font-normal m-0 mt-1 mb-2" style={{ fontSize: 26, letterSpacing: "-0.03em", color: "var(--ink)" }}>
          Create a category
        </h2>
        <p className="text-xs m-0 mb-5" style={{ color: "var(--pencil)" }}>
          Which book should this category belong to?
        </p>

        {books.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--pencil)" }}>
            Create a book first before adding a category.
          </p>
        ) : (
          <>
            <label className="block text-[10px] font-bold uppercase mb-1.5" style={{ color: "var(--pencil)", letterSpacing: "0.08em" }}>
              Book
            </label>
            <select
              value={selectedBookId}
              onChange={(e) => setSelectedBookId(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2.5 rounded-md border-[1.5px] outline-none text-sm mb-5"
              style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2.5">
              <button onClick={onClose} className="px-4 py-2.5 rounded-md text-sm font-medium" style={{ color: "var(--pencil)" }}>
                Cancel
              </button>
              <button
                onClick={() => setConfirmed(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-bold text-white"
                style={{ background: "var(--teal)" }}
              >
                Continue <ArrowUpRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}