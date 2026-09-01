"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { getCategory, getTranslations, ApiError, type Category } from "@/lib/api";
import CategorySequenceShell , { type StepId } from "@/components/CategorySequenceShell";
import LanguageSequencePanel from "@/components/LanguageSequencePanel";
import GenerateSequencePanel from "@/components/GenerateSequencePanel";
import PublishSequencePanel from "@/components/PublishSequencePanel";
import WordPressSequencePanel from "@/components/WordPressSequencePanel";

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const categoryName = decodeURIComponent(params.name);

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wordPressAvailable, setWordPressAvailable] = useState(false);
  const [wordPressSiteLabel, setWordPressSiteLabel] = useState("WordPress");
  const [languageNeedsAttention, setLanguageNeedsAttention] = useState(false);
  const [languageCheckTrigger, setLanguageCheckTrigger] = useState(0);

  
  useEffect(() => {
    if (!category) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const translations = await getTranslations(categoryName);
        if (cancelled) return;
        if (translations.length === 0) {
          setLanguageNeedsAttention(false); // no languages set up yet — that's Language's own empty state, not a "missing" warning
          return;
        }
        const incomplete = translations.some((t) => {
          const translatedSubjects = new Set(t.items.map((i) => i.subject_name));
          return category.subjects.some((s) => !translatedSubjects.has(s.name));
        });
        setLanguageNeedsAttention(incomplete);
      } catch {
        // silent — worst case, the nudge just doesn't show this time
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [category, categoryName, languageCheckTrigger]);
  
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
        const [historyRes, wpRes] = await Promise.all([
          fetch(`${API_BASE_URL}/publish/history/${encodeURIComponent(categoryName)}`),
          fetch(`${API_BASE_URL}/account/wordpress`),
        ]);
        const history = await historyRes.json();
        const wp = await wpRes.json();
        if (cancelled) return;
        setWordPressAvailable(Array.isArray(history) && history.length > 0);
        if (wp?.site_url) {
          const hostname = wp.site_url.replace(/^https?:\/\//, "").replace(/\/$/, "");
          setWordPressSiteLabel(`WordPress: ${hostname}`);
        }
      } catch {
        // silent — the sub-nav item just won't show if this fails
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryName]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCategory(categoryName);
        if (cancelled) return;
        setCategory(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Failed to load category");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [categoryName]);

  if (loading) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p style={{ color: "var(--pencil)" }}>Loading...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <div
          className="px-4 py-3 rounded-md text-sm"
          style={{ background: "var(--coral-light)", color: "var(--coral-dark)", border: "1px solid var(--coral)" }}
        >
          {error}
        </div>
        <button
          onClick={() => router.push("/books")}
          className="mt-6 px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--teal)" }}
        >
          Back to books
        </button>
      </main>
    );
  }

  if (notFound || !category) {
    return (
      <main className="min-h-screen px-8 py-12 max-w-3xl mx-auto">
        <p className="text-lg font-display" style={{ color: "var(--ink)" }}>
          Category not found
        </p>
        <button
          onClick={() => router.push("/books")}
          className="mt-6 px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--teal)" }}
        >
          Back to books
        </button>
      </main>
    );
  }

  return (
    <CategorySequenceShell
      bookId={category.book_id}
      bookName={category.book_name}
      categoryName={categoryName}
      hasAnyPairingSelected={category.subjects.length > 0 && category.variations.length > 0}
      wordPressStepAvailable={wordPressAvailable}
      wordPressSiteLabel={wordPressSiteLabel}
      languageNeedsAttention={languageNeedsAttention}
    >
       {(activeStep, setActiveStep) => {
        const goToStep = (step: StepId) => {
          if (step === "generate") setLanguageCheckTrigger((n) => n + 1);
          setActiveStep(step);
        };
        return (
          <>
            {activeStep === "generate" && (
              <GenerateSequencePanel
                categoryName={categoryName}
                category={category}
                onCategoryChanged={setCategory}
                languageNeedsAttention={languageNeedsAttention}
                onGoToLanguage={() => goToStep("language")}
              />
            )}
            {activeStep === "language" && (
              <LanguageSequencePanel
                categoryName={categoryName}
                bookId={category.book_id}
                subjects={category.subjects}
                variations={category.variations}
                onContinue={() => goToStep("publish")}
                onTranslationsChanged={() => setLanguageCheckTrigger((n) => n + 1)}
              />
            )}
            {activeStep === "publish" && (
              <PublishSequencePanel
                categoryName={categoryName}
                onGoToWordPress={() => goToStep("wordpress")}
                onGoToLanguage={() => goToStep("language")}
              />
            )}
            {activeStep === "wordpress" && (
              <WordPressSequencePanel categoryName={categoryName} onBackToFiles={goToStep} />
            )}
          </>
        );
      }}
    </CategorySequenceShell>
  );
}