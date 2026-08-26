# Ideas Backlog

A running list of UI/UX and feature ideas raised during development but


## UI / UX

- **Book-level image gallery/preview panel** — on the Books list or a
  Book's own page, a rolled-up view of already-generated images across
  all its categories (thumbnails), so you can see "what has this Book
  actually produced" at a glance instead of clicking into each category's
  Review tab individually. Raised while discussing the Book page
  restructure; deferred to let that restructure settle first before
  layering more onto it. Open questions: how to handle Books with many
  categories/images without the page becoming huge; whether rejected
  images should ever appear here.


## UI / UX (added during category-page rebuild)

- **Book-level preview comparison panel** — select 2-3 entries from Book
  Preview History and view them side-by-side (images + prompts +
  settings), to help evaluate iterative changes to prompt/knobs. Revisit
  now that knob data gives real structured differences to compare (see
  earlier discussion — this was deliberately deferred until there was
  enough combinatorial complexity to make comparison genuinely useful
  rather than something you can hold in your head).

- **Category-level knob overrides** — currently all 7 style knobs live at
  the Book level only. Considered exposing them on the category
  generate page too, with an enable-checkbox override pattern (same as
  today's per-knob enable/disable), so e.g. `subject_size_ratio` could
  differ per category without affecting the whole book. Real, sizeable
  feature — needs a new model, a shared resolution function so real
  generation/preview/pairs-generation don't each reimplement the
  fallback logic separately (avoiding the exact drift problem solved
  earlier this session), and category-page UI showing inherited vs.
  overridden values clearly. Deliberately not built yet — decided
  exposing book-wide knobs on a single category's page would be
  confusing without the override mechanism actually built first.
