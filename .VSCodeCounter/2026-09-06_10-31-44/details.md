# Details

Date : 2026-09-06 10:31:44

Directory /home/davidg/Developer/projects/coloring-book-gen2

Total : 115 files,  28002 codes, 1404 comments, 2065 blanks, all 31471 lines

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)

## Files
| filename | language | code | comment | blank | total |
| :--- | :--- | ---: | ---: | ---: | ---: |
| [README.md](/README.md) | Markdown | 218 | 0 | 48 | 266 |
| [backend/backup.sh](/backend/backup.sh) | Shell Script | 10 | 6 | 7 | 23 |
| [backend/database.py](/backend/database.py) | Python | 9 | 0 | 3 | 12 |
| [backend/main.py](/backend/main.py) | Python | 39 | 0 | 9 | 48 |
| [backend/models.py](/backend/models.py) | Python | 294 | 15 | 95 | 404 |
| [backend/requirements.txt](/backend/requirements.txt) | pip requirements | 34 | 0 | 1 | 35 |
| [backend/routers/\_\_init\_\_.py](/backend/routers/__init__.py) | Python | 0 | 0 | 1 | 1 |
| [backend/routers/account\_settings.py](/backend/routers/account_settings.py) | Python | 110 | 0 | 25 | 135 |
| [backend/routers/backup.py](/backend/routers/backup.py) | Python | 55 | 0 | 14 | 69 |
| [backend/routers/books.py](/backend/routers/books.py) | Python | 293 | 0 | 55 | 348 |
| [backend/routers/categories.py](/backend/routers/categories.py) | Python | 106 | 0 | 2 | 108 |
| [backend/routers/generation.py](/backend/routers/generation.py) | Python | 173 | 0 | 38 | 211 |
| [backend/routers/language\_templates.py](/backend/routers/language_templates.py) | Python | 88 | 0 | 13 | 101 |
| [backend/routers/prompt\_defaults.py](/backend/routers/prompt_defaults.py) | Python | 58 | 2 | 15 | 75 |
| [backend/routers/publish.py](/backend/routers/publish.py) | Python | 83 | 0 | 17 | 100 |
| [backend/routers/review.py](/backend/routers/review.py) | Python | 62 | 0 | 17 | 79 |
| [backend/routers/seo.py](/backend/routers/seo.py) | Python | 112 | 0 | 21 | 133 |
| [backend/routers/settings.py](/backend/routers/settings.py) | Python | 35 | 3 | 15 | 53 |
| [backend/routers/translations.py](/backend/routers/translations.py) | Python | 201 | 2 | 47 | 250 |
| [backend/routers/wordpress.py](/backend/routers/wordpress.py) | Python | 62 | 0 | 11 | 73 |
| [backend/schemas.py](/backend/schemas.py) | Python | 512 | 19 | 191 | 722 |
| [backend/services/\_\_init\_\_.py](/backend/services/__init__.py) | Python | 0 | 0 | 1 | 1 |
| [backend/services/backup.py](/backend/services/backup.py) | Python | 134 | 18 | 35 | 187 |
| [backend/services/book\_deletion.py](/backend/services/book_deletion.py) | Python | 142 | 21 | 34 | 197 |
| [backend/services/content\_variants.py](/backend/services/content_variants.py) | Python | 302 | 70 | 11 | 383 |
| [backend/services/generation.py](/backend/services/generation.py) | Python | 316 | 55 | 68 | 439 |
| [backend/services/job\_runner.py](/backend/services/job_runner.py) | Python | 52 | 5 | 11 | 68 |
| [backend/services/openai\_client.py](/backend/services/openai_client.py) | Python | 13 | 3 | 4 | 20 |
| [backend/services/prompt\_knobs.py](/backend/services/prompt_knobs.py) | Python | 137 | 50 | 29 | 216 |
| [backend/services/publish.py](/backend/services/publish.py) | Python | 223 | 11 | 48 | 282 |
| [backend/services/review.py](/backend/services/review.py) | Python | 98 | 20 | 18 | 136 |
| [backend/services/translate.py](/backend/services/translate.py) | Python | 72 | 9 | 19 | 100 |
| [backend/services/wordpress.py](/backend/services/wordpress.py) | Python | 21 | 3 | 7 | 31 |
| [backend/services/wordpress\_publish.py](/backend/services/wordpress_publish.py) | Python | 505 | 41 | 97 | 643 |
| [docs/README.md](/docs/README.md) | Markdown | 12 | 0 | 3 | 15 |
| [docs/architecture.md](/docs/architecture.md) | Markdown | 82 | 0 | 18 | 100 |
| [docs/data-model.md](/docs/data-model.md) | Markdown | 89 | 0 | 29 | 118 |
| [docs/decision-log.md](/docs/decision-log.md) | Markdown | 116 | 0 | 12 | 128 |
| [docs/environment-deployment.md](/docs/environment-deployment.md) | Markdown | 72 | 0 | 14 | 86 |
| [docs/generation-publishing.md](/docs/generation-publishing.md) | Markdown | 78 | 0 | 20 | 98 |
| [docs/ideas-backlog.md](/docs/ideas-backlog.md) | Markdown | 32 | 0 | 9 | 41 |
| [docs/seo-pipeline.md](/docs/seo-pipeline.md) | Markdown | 76 | 0 | 21 | 97 |
| [docs/wordpress-integration.md](/docs/wordpress-integration.md) | Markdown | 115 | 0 | 27 | 142 |
| [frontend/AGENTS.md](/frontend/AGENTS.md) | Markdown | 2 | 2 | 2 | 6 |
| [frontend/CLAUDE.md](/frontend/CLAUDE.md) | Markdown | 1 | 0 | 1 | 2 |
| [frontend/README.md](/frontend/README.md) | Markdown | 23 | 0 | 14 | 37 |
| [frontend/app/account/page.tsx](/frontend/app/account/page.tsx) | TypeScript JSX | 373 | 0 | 21 | 394 |
| [frontend/app/books/\[id\]/page.tsx](/frontend/app/books/%5Bid%5D/page.tsx) | TypeScript JSX | 313 | 1 | 25 | 339 |
| [frontend/app/books/\[id\]/settings/page.tsx](/frontend/app/books/%5Bid%5D/settings/page.tsx) | TypeScript JSX | 31 | 0 | 5 | 36 |
| [frontend/app/books/page.tsx](/frontend/app/books/page.tsx) | TypeScript JSX | 4 | 0 | 2 | 6 |
| [frontend/app/categories/\[id\]/page.tsx](/frontend/app/categories/%5Bid%5D/page.tsx) | TypeScript JSX | 231 | 6 | 14 | 251 |
| [frontend/app/categories/page.tsx](/frontend/app/categories/page.tsx) | TypeScript JSX | 4 | 0 | 2 | 6 |
| [frontend/app/globals.css](/frontend/app/globals.css) | PostCSS | 70 | 0 | 6 | 76 |
| [frontend/app/layout.tsx](/frontend/app/layout.tsx) | TypeScript JSX | 39 | 0 | 6 | 45 |
| [frontend/app/page.tsx](/frontend/app/page.tsx) | TypeScript JSX | 4 | 0 | 2 | 6 |
| [frontend/app/settings/page.tsx](/frontend/app/settings/page.tsx) | TypeScript JSX | 265 | 0 | 21 | 286 |
| [frontend/components/AppShell.tsx](/frontend/components/AppShell.tsx) | TypeScript JSX | 237 | 0 | 15 | 252 |
| [frontend/components/BackupSettingsPanel.tsx](/frontend/components/BackupSettingsPanel.tsx) | TypeScript JSX | 314 | 2 | 31 | 347 |
| [frontend/components/BatchHistoryPanel.tsx](/frontend/components/BatchHistoryPanel.tsx) | TypeScript JSX | 262 | 1 | 18 | 281 |
| [frontend/components/BookPreviewSection.tsx](/frontend/components/BookPreviewSection.tsx) | TypeScript JSX | 520 | 8 | 42 | 570 |
| [frontend/components/BookSettingsFields.tsx](/frontend/components/BookSettingsFields.tsx) | TypeScript JSX | 573 | 2 | 41 | 616 |
| [frontend/components/BookStyleSidebar.tsx](/frontend/components/BookStyleSidebar.tsx) | TypeScript JSX | 272 | 4 | 19 | 295 |
| [frontend/components/BooksLibrary.tsx](/frontend/components/BooksLibrary.tsx) | TypeScript JSX | 279 | 1 | 20 | 300 |
| [frontend/components/BulkPasteInput.tsx](/frontend/components/BulkPasteInput.tsx) | TypeScript JSX | 76 | 0 | 6 | 82 |
| [frontend/components/CategoriesLibrary.tsx](/frontend/components/CategoriesLibrary.tsx) | TypeScript JSX | 228 | 0 | 18 | 246 |
| [frontend/components/CategoryImageStrip.tsx](/frontend/components/CategoryImageStrip.tsx) | TypeScript JSX | 648 | 8 | 37 | 693 |
| [frontend/components/CategorySequenceShell.tsx](/frontend/components/CategorySequenceShell.tsx) | TypeScript JSX | 177 | 0 | 16 | 193 |
| [frontend/components/CategorySidebar.tsx](/frontend/components/CategorySidebar.tsx) | TypeScript JSX | 61 | 0 | 5 | 66 |
| [frontend/components/CollapsibleSection.tsx](/frontend/components/CollapsibleSection.tsx) | TypeScript JSX | 58 | 0 | 5 | 63 |
| [frontend/components/Dashboard.tsx](/frontend/components/Dashboard.tsx) | TypeScript JSX | 259 | 0 | 20 | 279 |
| [frontend/components/DeleteBookModal.tsx](/frontend/components/DeleteBookModal.tsx) | TypeScript JSX | 229 | 0 | 18 | 247 |
| [frontend/components/DeleteCategoryModal.tsx](/frontend/components/DeleteCategoryModal.tsx) | TypeScript JSX | 224 | 0 | 16 | 240 |
| [frontend/components/EditListModal.tsx](/frontend/components/EditListModal.tsx) | TypeScript JSX | 177 | 0 | 15 | 192 |
| [frontend/components/ExpandableTextModal.tsx](/frontend/components/ExpandableTextModal.tsx) | TypeScript JSX | 96 | 0 | 9 | 105 |
| [frontend/components/GenerateSequencePanel.tsx](/frontend/components/GenerateSequencePanel.tsx) | TypeScript JSX | 485 | 1 | 47 | 533 |
| [frontend/components/KnobsPanel.tsx](/frontend/components/KnobsPanel.tsx) | TypeScript JSX | 227 | 3 | 19 | 249 |
| [frontend/components/LanguagePills.tsx](/frontend/components/LanguagePills.tsx) | TypeScript JSX | 35 | 0 | 0 | 35 |
| [frontend/components/LanguageSequencePanel.tsx](/frontend/components/LanguageSequencePanel.tsx) | TypeScript JSX | 448 | 2 | 24 | 474 |
| [frontend/components/NewBookModal.tsx](/frontend/components/NewBookModal.tsx) | TypeScript JSX | 133 | 0 | 12 | 145 |
| [frontend/components/NewBookWizard.tsx](/frontend/components/NewBookWizard.tsx) | TypeScript JSX | 613 | 0 | 23 | 636 |
| [frontend/components/NewCategoryFromLibraryModal.tsx](/frontend/components/NewCategoryFromLibraryModal.tsx) | TypeScript JSX | 79 | 0 | 6 | 85 |
| [frontend/components/NewCategoryModal.tsx](/frontend/components/NewCategoryModal.tsx) | TypeScript JSX | 95 | 0 | 10 | 105 |
| [frontend/components/PrepareCategoryPanel.tsx](/frontend/components/PrepareCategoryPanel.tsx) | TypeScript JSX | 218 | 1 | 16 | 235 |
| [frontend/components/PublishSequencePanel.tsx](/frontend/components/PublishSequencePanel.tsx) | TypeScript JSX | 866 | 2 | 36 | 904 |
| [frontend/components/ReviewPanel.tsx](/frontend/components/ReviewPanel.tsx) | TypeScript JSX | 287 | 1 | 21 | 309 |
| [frontend/components/SequencePanel.tsx](/frontend/components/SequencePanel.tsx) | TypeScript JSX | 54 | 0 | 4 | 58 |
| [frontend/components/SettingsUI.tsx](/frontend/components/SettingsUI.tsx) | TypeScript JSX | 335 | 0 | 18 | 353 |
| [frontend/components/TabbedSection.tsx](/frontend/components/TabbedSection.tsx) | TypeScript JSX | 88 | 0 | 8 | 96 |
| [frontend/components/TemplateField.tsx](/frontend/components/TemplateField.tsx) | TypeScript JSX | 86 | 1 | 11 | 98 |
| [frontend/components/ThemeToggle.tsx](/frontend/components/ThemeToggle.tsx) | TypeScript JSX | 33 | 0 | 7 | 40 |
| [frontend/components/TranslationEditorModal.tsx](/frontend/components/TranslationEditorModal.tsx) | TypeScript JSX | 530 | 0 | 25 | 555 |
| [frontend/components/WordPressPushPanel.tsx](/frontend/components/WordPressPushPanel.tsx) | TypeScript JSX | 585 | 10 | 42 | 637 |
| [frontend/components/WordPressSequencePanel.tsx](/frontend/components/WordPressSequencePanel.tsx) | TypeScript JSX | 31 | 0 | 0 | 31 |
| [frontend/eslint.config.mjs](/frontend/eslint.config.mjs) | JavaScript | 14 | 2 | 3 | 19 |
| [frontend/lib/api/account.ts](/frontend/lib/api/account.ts) | TypeScript | 11 | 0 | 3 | 14 |
| [frontend/lib/api/books.ts](/frontend/lib/api/books.ts) | TypeScript | 17 | 0 | 5 | 22 |
| [frontend/lib/api/categories.ts](/frontend/lib/api/categories.ts) | TypeScript | 17 | 0 | 5 | 22 |
| [frontend/lib/api/client.ts](/frontend/lib/api/client.ts) | TypeScript | 38 | 3 | 9 | 50 |
| [frontend/lib/api/generated-types.ts](/frontend/lib/api/generated-types.ts) | TypeScript | 4,023 | 983 | 2 | 5,008 |
| [frontend/lib/api/generation.ts](/frontend/lib/api/generation.ts) | TypeScript | 19 | 0 | 4 | 23 |
| [frontend/lib/api/index.ts](/frontend/lib/api/index.ts) | TypeScript | 9 | 0 | 0 | 9 |
| [frontend/lib/api/promptDefaults.ts](/frontend/lib/api/promptDefaults.ts) | TypeScript | 8 | 0 | 2 | 10 |
| [frontend/lib/api/settings.ts](/frontend/lib/api/settings.ts) | TypeScript | 8 | 0 | 2 | 10 |
| [frontend/lib/api/translations.ts](/frontend/lib/api/translations.ts) | TypeScript | 28 | 0 | 5 | 33 |
| [frontend/lib/api/types.ts](/frontend/lib/api/types.ts) | TypeScript | 142 | 6 | 36 | 184 |
| [frontend/next.config.ts](/frontend/next.config.ts) | TypeScript | 4 | 1 | 3 | 8 |
| [frontend/package-lock.json](/frontend/package-lock.json) | JSON | 7,071 | 0 | 1 | 7,072 |
| [frontend/package.json](/frontend/package.json) | JSON | 29 | 0 | 1 | 30 |
| [frontend/postcss.config.mjs](/frontend/postcss.config.mjs) | JavaScript | 6 | 0 | 2 | 8 |
| [frontend/public/file.svg](/frontend/public/file.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/globe.svg](/frontend/public/globe.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/next.svg](/frontend/public/next.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/vercel.svg](/frontend/public/vercel.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/public/window.svg](/frontend/public/window.svg) | XML | 1 | 0 | 0 | 1 |
| [frontend/tsconfig.json](/frontend/tsconfig.json) | JSON with Comments | 34 | 0 | 1 | 35 |

[Summary](results.md) / Details / [Diff Summary](diff.md) / [Diff Details](diff-details.md)