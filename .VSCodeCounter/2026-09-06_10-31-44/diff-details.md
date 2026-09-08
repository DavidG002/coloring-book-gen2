# Diff Details

Date : 2026-09-06 10:31:44

Directory /home/davidg/Developer/projects/coloring-book-gen2

Total : 59 files,  3543 codes, 175 comments, 113 blanks, all 3831 lines

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [backend/models.py](/backend/models.py) | Python | 15 | 0 | 2 | 17 |
| [backend/routers/books.py](/backend/routers/books.py) | Python | 6 | 0 | -1 | 5 |
| [backend/routers/categories.py](/backend/routers/categories.py) | Python | 4 | 0 | -30 | -26 |
| [backend/routers/generation.py](/backend/routers/generation.py) | Python | 33 | 0 | 9 | 42 |
| [backend/routers/review.py](/backend/routers/review.py) | Python | 1 | 0 | 0 | 1 |
| [backend/routers/seo.py](/backend/routers/seo.py) | Python | 15 | 0 | 1 | 16 |
| [backend/routers/translations.py](/backend/routers/translations.py) | Python | 0 | -2 | 2 | 0 |
| [backend/routers/wordpress.py](/backend/routers/wordpress.py) | Python | 13 | 0 | 1 | 14 |
| [backend/schemas.py](/backend/schemas.py) | Python | 31 | 1 | 14 | 46 |
| [backend/services/book\_deletion.py](/backend/services/book_deletion.py) | Python | 2 | 0 | 0 | 2 |
| [backend/services/content\_variants.py](/backend/services/content_variants.py) | Python | 102 | 42 | 3 | 147 |
| [backend/services/generation.py](/backend/services/generation.py) | Python | 35 | 14 | 2 | 51 |
| [backend/services/job\_runner.py](/backend/services/job_runner.py) | Python | 2 | 0 | 0 | 2 |
| [backend/services/prompt\_knobs.py](/backend/services/prompt_knobs.py) | Python | 41 | 21 | 8 | 70 |
| [backend/services/publish.py](/backend/services/publish.py) | Python | 3 | 0 | 1 | 4 |
| [backend/services/review.py](/backend/services/review.py) | Python | 6 | 12 | -5 | 13 |
| [backend/services/wordpress\_publish.py](/backend/services/wordpress_publish.py) | Python | 60 | 11 | 8 | 79 |
| [docs/decision-log.md](/docs/decision-log.md) | Markdown | 10 | 0 | 2 | 12 |
| [docs/ideas-backlog.md](/docs/ideas-backlog.md) | Markdown | 20 | 0 | 3 | 23 |
| [frontend/app/account/page.tsx](/frontend/app/account/page.tsx) | TypeScript JSX | 373 | 0 | 21 | 394 |
| [frontend/app/books/\[id\]/page.tsx](/frontend/app/books/%5Bid%5D/page.tsx) | TypeScript JSX | 69 | 0 | 4 | 73 |
| [frontend/app/books/new/page.tsx](/frontend/app/books/new/page.tsx) | TypeScript JSX | -142 | 0 | -13 | -155 |
| [frontend/app/books/page.tsx](/frontend/app/books/page.tsx) | TypeScript JSX | -70 | 0 | -2 | -72 |
| [frontend/app/categories/\[id\]/page.tsx](/frontend/app/categories/%5Bid%5D/page.tsx) | TypeScript JSX | 231 | 6 | 14 | 251 |
| [frontend/app/categories/\[name\]/page.tsx](/frontend/app/categories/%5Bname%5D/page.tsx) | TypeScript JSX | -139 | 0 | -11 | -150 |
| [frontend/app/categories/page.tsx](/frontend/app/categories/page.tsx) | TypeScript JSX | 4 | 0 | 2 | 6 |
| [frontend/app/settings/page.tsx](/frontend/app/settings/page.tsx) | TypeScript JSX | -274 | 0 | -25 | -299 |
| [frontend/components/AppShell.tsx](/frontend/components/AppShell.tsx) | TypeScript JSX | 237 | 0 | 15 | 252 |
| [frontend/components/BatchHistoryPanel.tsx](/frontend/components/BatchHistoryPanel.tsx) | TypeScript JSX | 262 | 1 | 18 | 281 |
| [frontend/components/BookPreviewSection.tsx](/frontend/components/BookPreviewSection.tsx) | TypeScript JSX | -7 | 0 | 1 | -6 |
| [frontend/components/BookSettingsFields.tsx](/frontend/components/BookSettingsFields.tsx) | TypeScript JSX | 123 | 0 | 1 | 124 |
| [frontend/components/BookStyleSidebar.tsx](/frontend/components/BookStyleSidebar.tsx) | TypeScript JSX | 272 | 4 | 19 | 295 |
| [frontend/components/BooksLibrary.tsx](/frontend/components/BooksLibrary.tsx) | TypeScript JSX | 279 | 1 | 20 | 300 |
| [frontend/components/CategoriesLibrary.tsx](/frontend/components/CategoriesLibrary.tsx) | TypeScript JSX | 228 | 0 | 18 | 246 |
| [frontend/components/CategoryImageStrip.tsx](/frontend/components/CategoryImageStrip.tsx) | TypeScript JSX | 226 | 3 | 2 | 231 |
| [frontend/components/CategorySequenceShell.tsx](/frontend/components/CategorySequenceShell.tsx) | TypeScript JSX | 66 | 0 | 5 | 71 |
| [frontend/components/Dashboard.tsx](/frontend/components/Dashboard.tsx) | TypeScript JSX | -139 | -2 | -7 | -148 |
| [frontend/components/DeleteCategoryModal.tsx](/frontend/components/DeleteCategoryModal.tsx) | TypeScript JSX | 2 | 0 | -1 | 1 |
| [frontend/components/EditListModal.tsx](/frontend/components/EditListModal.tsx) | TypeScript JSX | 177 | 0 | 15 | 192 |
| [frontend/components/ExpandableTextModal.tsx](/frontend/components/ExpandableTextModal.tsx) | TypeScript JSX | 96 | 0 | 9 | 105 |
| [frontend/components/GeneratePanel.tsx](/frontend/components/GeneratePanel.tsx) | TypeScript JSX | -323 | -5 | -27 | -355 |
| [frontend/components/GenerateSequencePanel.tsx](/frontend/components/GenerateSequencePanel.tsx) | TypeScript JSX | 99 | 0 | 6 | 105 |
| [frontend/components/LanguagePills.tsx](/frontend/components/LanguagePills.tsx) | TypeScript JSX | 5 | 0 | -2 | 3 |
| [frontend/components/LanguageSequencePanel.tsx](/frontend/components/LanguageSequencePanel.tsx) | TypeScript JSX | 448 | 2 | 24 | 474 |
| [frontend/components/NewBookModal.tsx](/frontend/components/NewBookModal.tsx) | TypeScript JSX | 133 | 0 | 12 | 145 |
| [frontend/components/NewBookWizard.tsx](/frontend/components/NewBookWizard.tsx) | TypeScript JSX | 613 | 0 | 23 | 636 |
| [frontend/components/NewCategoryFromLibraryModal.tsx](/frontend/components/NewCategoryFromLibraryModal.tsx) | TypeScript JSX | 79 | 0 | 6 | 85 |
| [frontend/components/NewCategoryModal.tsx](/frontend/components/NewCategoryModal.tsx) | TypeScript JSX | -1 | 0 | 1 | 0 |
| [frontend/components/PrepareCategoryPanel.tsx](/frontend/components/PrepareCategoryPanel.tsx) | TypeScript JSX | 71 | 1 | 3 | 75 |
| [frontend/components/PublishPanel.tsx](/frontend/components/PublishPanel.tsx) | TypeScript JSX | -428 | -1 | -32 | -461 |
| [frontend/components/PublishSequencePanel.tsx](/frontend/components/PublishSequencePanel.tsx) | TypeScript JSX | 866 | 2 | 36 | 904 |
| [frontend/components/SeoPanel.tsx](/frontend/components/SeoPanel.tsx) | TypeScript JSX | -438 | -1 | -32 | -471 |
| [frontend/components/SettingsUI.tsx](/frontend/components/SettingsUI.tsx) | TypeScript JSX | 52 | 0 | 2 | 54 |
| [frontend/components/TranslationEditorModal.tsx](/frontend/components/TranslationEditorModal.tsx) | TypeScript JSX | 530 | 0 | 25 | 555 |
| [frontend/components/TranslationsPanel.tsx](/frontend/components/TranslationsPanel.tsx) | TypeScript JSX | -778 | -1 | -55 | -834 |
| [frontend/components/WordPressPushPanel.tsx](/frontend/components/WordPressPushPanel.tsx) | TypeScript JSX | 27 | 10 | -2 | 35 |
| [frontend/components/WordPressSequencePanel.tsx](/frontend/components/WordPressSequencePanel.tsx) | TypeScript JSX | 31 | 0 | 0 | 31 |
| [frontend/lib/api/generated-types.ts](/frontend/lib/api/generated-types.ts) | TypeScript | 184 | 56 | 0 | 240 |
| [frontend/package-lock.json](/frontend/package-lock.json) | JSON | 100 | 0 | 0 | 100 |

[Summary](results.md) / [Details](details.md) / [Diff Summary](diff.md) / Diff Details