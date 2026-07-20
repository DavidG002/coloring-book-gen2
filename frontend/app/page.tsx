import Link from "next/link";
import { getCategories } from "@/lib/api";

export default async function Home() {
  const categories = await getCategories();

  return (
    <main className="min-h-screen px-8 py-12 max-w-5xl mx-auto">
      <header className="flex items-end justify-between mb-10 pb-6 border-b-2" style={{ borderColor: "var(--pencil-light)" }}>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
            Categories
          </h1>
          <p className="mt-1" style={{ color: "var(--pencil)" }}>
            Manage subjects, prompts, and pose variations for each category.
          </p>
        </div>
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="px-4 py-2.5 rounded-md text-sm font-medium"
          style={{ color: "var(--pencil)", border: "1.5px solid var(--pencil-light)" }}
        >
          Settings
        </Link>
        <Link
          href="/categories/new"
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white transition-colors"
          style={{ background: "var(--teal)" }}
        >
          New category
        </Link>
      </div>
      </header>

      {categories.length === 0 ? (
        <div
          className="rounded-lg border-2 border-dashed p-12 text-center"
          style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}
        >
          <p className="text-lg font-display mb-2" style={{ color: "var(--ink)" }}>
            No categories yet
          </p>
          <p className="mb-6">Create your first category to start defining subjects and prompts.</p>
          <Link
            href="/categories/new"
            className="px-5 py-2.5 rounded-md text-sm font-medium text-white inline-block"
            style={{ background: "var(--teal)" }}
          >
            New category
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${encodeURIComponent(category.name)}`}
              className="group relative block rounded-lg border-[1.5px] p-5 transition-shadow hover:shadow-md"
              style={{ background: "var(--canvas)", borderColor: "var(--pencil-light)" }}
            >
              <span
                className="absolute -top-2.5 left-5 px-2 text-xs font-medium rounded"
                style={{ background: "var(--teal)", color: "white" }}
              >
                {category.subject_count} {category.subject_count === 1 ? "subject" : "subjects"}
              </span>
              <h2 className="font-display text-xl font-semibold mt-2 capitalize" style={{ color: "var(--ink)" }}>
                {category.name}
              </h2>
              <p className="mt-2 text-sm" style={{ color: "var(--pencil)" }}>
                {category.variation_count} pose {category.variation_count === 1 ? "variation" : "variations"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}