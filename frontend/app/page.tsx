import Link from "next/link";
import { getBooks, getCategories } from "@/lib/api";

export default async function DashboardPage() {
  const [books, categories] = await Promise.all([getBooks(), getCategories()]);
  const totalSubjects = categories.reduce((sum, c) => sum + c.subject_count, 0);
  const totalVariations = categories.reduce((sum, c) => sum + c.variation_count, 0);

  return (
    <main className="min-h-screen px-8 py-12 max-w-5xl mx-auto">
      <header className="mb-10 pb-6 border-b-2" style={{ borderColor: "var(--pencil-light)" }}>
        <h1 className="text-4xl font-semibold tracking-tight font-display" style={{ color: "var(--ink)" }}>
          Dashboard
        </h1>
        <p className="mt-1" style={{ color: "var(--pencil)" }}>
          Overview of your books and categories.
        </p>
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Books", value: books.length },
          { label: "Categories", value: categories.length },
          { label: "Subjects", value: totalSubjects },
          { label: "Variations", value: totalVariations },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border-[1.5px] p-5"
            style={{ borderColor: "var(--pencil-light)", background: "var(--canvas)" }}
          >
            <p className="text-3xl font-display font-semibold" style={{ color: "var(--ink)" }}>
              {stat.value}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--pencil)" }}>
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <Link
          href="/books"
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: "var(--teal)" }}
        >
          Go to books {"\u2192"}
        </Link>
        <Link
          href="/settings"
          className="px-5 py-2.5 rounded-md text-sm font-medium"
          style={{ color: "var(--pencil)", border: "1.5px solid var(--pencil-light)" }}
        >
          Settings
        </Link>
      </div>
    </main>
  );
}
