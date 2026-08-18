"use client";

import { useRouter, useParams, useSearchParams } from "next/navigation";
import BookSettingsFields from "@/components/BookSettingsFields";
import BookPreviewSection from "@/components/BookPreviewSection";

export default function BookSettingsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const bookId = parseInt(params.id, 10);
  const searchParams = useSearchParams();
  const fromPath = searchParams.get("from");

  return (
    <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
      <header className="mb-8">
        <button
          onClick={() => router.push(fromPath || `/books/${bookId}`)}
          className="text-sm mb-3 inline-block"
          style={{ color: "var(--pencil)" }}
        >
          {"\u2190"} Back
        </button>
        <h1 className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
          Book settings
        </h1>
      </header>

      <div className="space-y-10">
        <BookSettingsFields bookId={bookId} />
        <BookPreviewSection bookId={bookId} />
      </div>
    </main>
  );
}
