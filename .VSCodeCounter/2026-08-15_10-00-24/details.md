# Details

Date : 2026-08-15 10:00:24

Directory /home/davidg/Developer/projects/coloring-book-gen2

Total : 78 files,  16532 codes, 187 comments, 1384 blanks, all 18103 lines

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [README.md](/README.md) | Markdown | 93 | 0 | 31 | 124 |
| [backend/database.py](/backend/database.py) | Python | 9 | 0 | 3 | 12 |
| [backend/main.py](/backend/main.py) | Python | 29 | 0 | 8 | 37 |
| [backend/models.py](/backend/models.py) | Python | 235 | 13 | 84 | 332 |
| [backend/requirements.txt](/backend/requirements.txt) | pip requirements | 34 | 0 | 1 | 35 |
| [backend/routers/\_\_init\_\_.py](/backend/routers/__init__.py) | Python | 0 | 0 | 1 | 1 |
| [backend/routers/account\_settings.py](/backend/routers/account_settings.py) | Python | 110 | 0 | 25 | 135 |
| [backend/routers/books.py](/backend/routers/books.py) | Python | 154 | 0 | 36 | 190 |
| [backend/routers/categories.py](/backend/routers/categories.py) | Python | 102 | 0 | 32 | 134 |
| [backend/routers/generation.py](/backend/routers/generation.py) | Python | 95 | 0 | 19 | 114 |
| [backend/routers/language\_templates.py](/backend/routers/language_templates.py) | Python | 88 | 0 | 13 | 101 |
| [backend/routers/prompt\_defaults.py](/backend/routers/prompt_defaults.py) | Python | 58 | 2 | 15 | 75 |
| [backend/routers/publish.py](/backend/routers/publish.py) | Python | 83 | 0 | 15 | 98 |
| [backend/routers/review.py](/backend/routers/review.py) | Python | 57 | 0 | 15 | 72 |
| [backend/routers/seo.py](/backend/routers/seo.py) | Python | 97 | 0 | 20 | 117 |
| [backend/routers/settings.py](/backend/routers/settings.py) | Python | 35 | 3 | 15 | 53 |
| [backend/routers/translations.py](/backend/routers/translations.py) | Python | 201 | 4 | 45 | 250 |
| [backend/routers/wordpress.py](/backend/routers/wordpress.py) | Python | 40 | 0 | 9 | 49 |
| [backend/schemas.py](/backend/schemas.py) | Python | 368 | 16 | 145 | 529 |
| [backend/services/\_\_init\_\_.py](/backend/services/__init__.py) | Python | 0 | 0 | 1 | 1 |
| [backend/services/book\_deletion.py](/backend/services/book_deletion.py) | Python | 140 | 21 | 34 | 195 |
| [backend/services/content\_variants.py](/backend/services/content_variants.py) | Python | 200 | 28 | 8 | 236 |
| [backend/services/generation.py](/backend/services/generation.py) | Python | 168 | 17 | 43 | 228 |
| [backend/services/job\_runner.py](/backend/services/job_runner.py) | Python | 49 | 5 | 12 | 66 |
| [backend/services/openai\_client.py](/backend/services/openai_client.py) | Python | 13 | 3 | 4 | 20 |
| [backend/services/publish.py](/backend/services/publish.py) | Python | 220 | 11 | 47 | 278 |
| [backend/services/review.py](/backend/services/review.py) | Python | 53 | 3 | 19 | 75 |
| [backend/services/translate.py](/backend/services/translate.py) | Python | 70 | 6 | 17 | 93 |
| [backend/services/wordpress.py](/backend/services/wordpress.py) | Python | 21 | 3 | 7 | 31 |
| [backend/services/wordpress\_publish.py](/backend/services/wordpress_publish.py) | Python | 312 | 19 | 61 | 392 |
| [frontend/AGENTS.md](/frontend/AGENTS.md) | Markdown | 2 | 2 | 2 | 6 |
| [frontend/CLAUDE.md](/frontend/CLAUDE.md) | Markdown | 1 | 0 | 1 | 2 |
| [frontend/README.md](/frontend/README.md) | Markdown | 23 | 0 | 14 | 37 |
| [frontend/app/books/\[id\]/page.tsx](/frontend/app/books/%5Bid%5D/page.tsx) | TypeScript JSX | 191 | 0 | 16 | 207 |
| [frontend/app/books/\[id\]/settings/page.tsx](/frontend/app/books/%5Bid%5D/settings/page.tsx) | TypeScript JSX | 791 | 0 | 52 | 843 |
| [frontend/app/books/new/page.tsx](/frontend/app/books/new/page.tsx) | TypeScript JSX | 142 | 0 | 13 | 155 |
| [frontend/app/books/page.tsx](/frontend/app/books/page.tsx) | TypeScript JSX | 74 | 0 | 4 | 78 |
| [frontend/app/categories/\[name\]/page.tsx](/frontend/app/categories/%5Bname%5D/page.tsx) | TypeScript JSX | 490 | 0 | 42 | 532 |
| [frontend/app/globals.css](/frontend/app/globals.css) | PostCSS | 34 | 0 | 5 | 39 |
| [frontend/app/layout.tsx](/frontend/app/layout.tsx) | TypeScript JSX | 44 | 0 | 6 | 50 |
| [frontend/app/page.tsx](/frontend/app/page.tsx) | TypeScript JSX | 58 | 0 | 4 | 62 |
| [frontend/app/settings/page.tsx](/frontend/app/settings/page.tsx) | TypeScript JSX | 621 | 9 | 52 | 682 |
| [frontend/components/BulkPasteInput.tsx](/frontend/components/BulkPasteInput.tsx) | TypeScript JSX | 76 | 0 | 6 | 82 |
| [frontend/components/CategorySidebar.tsx](/frontend/components/CategorySidebar.tsx) | TypeScript JSX | 61 | 0 | 5 | 66 |
| [frontend/components/CollapsibleSection.tsx](/frontend/components/CollapsibleSection.tsx) | TypeScript JSX | 58 | 0 | 5 | 63 |
| [frontend/components/DeleteBookModal.tsx](/frontend/components/DeleteBookModal.tsx) | TypeScript JSX | 240 | 0 | 19 | 259 |
| [frontend/components/DeleteCategoryModal.tsx](/frontend/components/DeleteCategoryModal.tsx) | TypeScript JSX | 228 | 0 | 17 | 245 |
| [frontend/components/GeneratePanel.tsx](/frontend/components/GeneratePanel.tsx) | TypeScript JSX | 323 | 5 | 27 | 355 |
| [frontend/components/NewCategoryModal.tsx](/frontend/components/NewCategoryModal.tsx) | TypeScript JSX | 96 | 0 | 9 | 105 |
| [frontend/components/PublishPanel.tsx](/frontend/components/PublishPanel.tsx) | TypeScript JSX | 477 | 1 | 37 | 515 |
| [frontend/components/ReviewPanel.tsx](/frontend/components/ReviewPanel.tsx) | TypeScript JSX | 298 | 1 | 22 | 321 |
| [frontend/components/SeoPanel.tsx](/frontend/components/SeoPanel.tsx) | TypeScript JSX | 449 | 1 | 33 | 483 |
| [frontend/components/TabbedSection.tsx](/frontend/components/TabbedSection.tsx) | TypeScript JSX | 88 | 0 | 8 | 96 |
| [frontend/components/TemplateField.tsx](/frontend/components/TemplateField.tsx) | TypeScript JSX | 86 | 1 | 11 | 98 |
| [frontend/components/ThemeToggle.tsx](/frontend/components/ThemeToggle.tsx) | TypeScript JSX | 33 | 0 | 7 | 40 |
| [frontend/components/TranslationsPanel.tsx](/frontend/components/TranslationsPanel.tsx) | TypeScript JSX | 778 | 1 | 55 | 834 |
| [frontend/components/WordPressPushPanel.tsx](/frontend/components/WordPressPushPanel.tsx) | TypeScript JSX | 526 | 0 | 45 | 571 |
| [frontend/eslint.config.mjs](/frontend/eslint.config.mjs) | JavaScript | 14 | 2 | 3 | 19 |
| [frontend/lib/api/account.ts](/frontend/lib/api/account.ts) | TypeScript | 11 | 0 | 3 | 14 |
| [frontend/lib/api/books.ts](/frontend/lib/api/books.ts) | TypeScript | 17 | 0 | 5 | 22 |
| [frontend/lib/api/categories.ts](/frontend/lib/api/categories.ts) | TypeScript | 17 | 0 | 5 | 22 |
| [frontend/lib/api/client.ts](/frontend/lib/api/client.ts) | TypeScript | 38 | 3 | 9 | 50 |
| [frontend/lib/api/generation.ts](/frontend/lib/api/generation.ts) | TypeScript | 19 | 0 | 4 | 23 |
| [frontend/lib/api/index.ts](/frontend/lib/api/index.ts) | TypeScript | 9 | 0 | 0 | 9 |
| [frontend/lib/api/promptDefaults.ts](/frontend/lib/api/promptDefaults.ts) | TypeScript | 8 | 0 | 2 | 10 |
| [frontend/lib/api/settings.ts](/frontend/lib/api/settings.ts) | TypeScript | 8 | 0 | 2 | 10 |
| [frontend/lib/api/translations.ts](/frontend/lib/api/translations.ts) | TypeScript | 28 | 0 | 5 | 33 |
| [frontend/lib/api/types.ts](/frontend/lib/api/types.ts) | TypeScript | 162 | 6 | 36 | 204 |
| [frontend/next.config.ts](/frontend/next.config.ts) | TypeScript | 4 | 1 | 3 | 8 |
| [frontend/package-lock.json](/frontend/package-lock.json) | JSON | 6,704 | 0 | 1 | 6,705 |
| [frontend/package.json](/frontend/package.json) | JSON | 26 | 0 | 1 | 27 |
| [frontend/postcss.config.mjs](/frontend/postcss.config.mjs) | JavaScript | 6 | 0 | 2 | 8 |
| [frontend/public/file.svg](/frontend/public/file.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/globe.svg](/frontend/public/globe.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/next.svg](/frontend/public/next.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/vercel.svg](/frontend/public/vercel.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/window.svg](/frontend/public/window.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/tsconfig.json](/frontend/tsconfig.json) | JSON with Comments | 34 | 0 | 1 | 35 |

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)