"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Languages, Send } from "lucide-react";
import { getCategory, ApiError, type Category } from "@/lib/api";
import CategorySequenceShell from "@/components/CategorySequenceShell";
import SequencePanel from "@/components/SequencePanel";
import TabbedSection from "@/components/TabbedSection";
import TranslationsPanel from "@/components/TranslationsPanel";
import SeoPanel from "@/components/SeoPanel";
import PublishPanel from "@/components/PublishPanel";
import WordPressPushPanel from "@/components/WordPressPushPanel";
import GenerateSequencePanel from "@/components/GenerateSequencePanel";

export default function CategoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ name: string }>();
  const categoryName = decodeURIComponent(params.name);

  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    >
      {(activeStep) => (
        <>
          {activeStep === "generate" && (
            <GenerateSequencePanel categoryName={categoryName} category={category} onCategoryChanged={setCategory} />
          )}
          {activeStep === "language" && (
            <SequencePanel
              eyebrow="02 / LANGUAGE"
              title="Translate and describe your pages"
              description="Keep the generated copy consistent across every page in this category."
              icon={<Languages size={25} />}
            >
              <div className="p-2">
                <TabbedSection
                  id="language-tabs"
                  title=""
                  isOpen
                  onToggle={() => {}}
                  tabs={[
                    {
                      id: "translations",
                      label: "Translations",
                      content: (
                        <TranslationsPanel
                          categoryName={categoryName}
                          bookId={category.book_id}
                          subjects={category.subjects}
                          variations={category.variations}
                        />
                      ),
                    },
                    { id: "seo", label: "SEO", content: <SeoPanel categoryName={categoryName} /> },
                  ]}
                />
              </div>
            </SequencePanel>
          )}

          {activeStep === "publish" && (
            <SequencePanel
              eyebrow="03 / PUBLISH"
              title="Publish to your book"
              description="When you're happy with the generated pages, publish this category."
              icon={<Send size={25} />}
            >
              <div className="p-2">
                <TabbedSection
                  id="publish-tabs"
                  title=""
                  isOpen
                  onToggle={() => {}}
                  tabs={[
                    { id: "local", label: "Local", content: <PublishPanel categoryName={categoryName} /> },
                    { id: "wordpress", label: "WordPress", content: <WordPressPushPanel categoryName={categoryName} /> },
                  ]}
                />
              </div>
            </SequencePanel>
          )}
        </>
      )}
    </CategorySequenceShell>
  );
}
