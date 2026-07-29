import Link from "next/link";
import { getBooks } from "@/lib/api";

export default async function BooksPage() {
  const books = await getBooks();

  return (
    <main className="min-h-screen px-8 py-12 max-w-5xl mx-auto">
      <header className="flex items-end justify-between mb-10 pb-6 border-b-2" style={{ borderColor: "var(--pencil-light)" }}>
        <div>
          <Link
            href="/"
            className="text-sm mb-3 inline-block"
            style={{ color: "var(--pencil)" }}
          >
            {"\u2190"} Dashboard
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight font-display" style={{ color: "var(--ink)" }}>
            Books
          </h1>
          <p className="mt-1" style={{ color: "var(--pencil)" }}>
            Each book defines a shared style, prompt, and image settings for its categories.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/books/new"
            className="px-5 py-2.5 rounded-md text-sm font-medium text-white transition-colors"
            style={{ background: "var(--teal)" }}
          >
            New book
          </Link>
        </div>
      </header>
      
      {books.length === 0 ? (
        <div
          className="rounded-lg border-2 border-dashed p-12 text-center"
          style={{ borderColor: "var(--pencil-light)", color: "var(--pencil)" }}
        >
          <p className="text-lg font-display mb-2" style={{ color: "var(--ink)" }}>
            No books yet
          </p>
          <p className="mb-6">Create your first book to define a style and settings for a set of categories.</p>
          <Link
            href="/books/new"
            className="px-5 py-2.5 rounded-md text-sm font-medium text-white inline-block"
            style={{ background: "var(--teal)" }}
          >
            New book
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="group relative block rounded-lg border-[1.5px] p-5 transition-shadow hover:shadow-md"
              style={{ background: "var(--canvas)", borderColor: "var(--pencil-light)" }}
            >
              <span
                className="absolute -top-2.5 left-5 px-2 text-xs font-medium rounded"
                style={{ background: "var(--teal)", color: "white" }}
              >
                {book.category_count} {book.category_count === 1 ? "category" : "categories"}
              </span>
              <h2 className="font-display text-xl font-semibold mt-2" style={{ color: "var(--ink)" }}>
                {book.name}
              </h2>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
