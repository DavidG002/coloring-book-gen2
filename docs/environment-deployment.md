# Environment & Deployment Notes

## Local development setup

See the main [README](../README.md) for the full setup sequence
(cloning, venv, `.env.local`, first-run Settings configuration). This
doc covers things worth knowing *beyond* that basic setup — real issues
hit during development, and what would need to change for anything
beyond a single local user.

## Platform-specific gotchas actually encountered

- **`venv` not activated in a fresh terminal** — the single most common
  source of confusing errors during this project (`ModuleNotFoundError:
  No module named 'sqlalchemy'` when running a one-off script). Always
  confirm `source venv/bin/activate` was run in *that specific terminal
  session* before running any backend Python directly — a new terminal
  tab does not inherit an already-activated venv from another tab.
- **Migrating machines mid-project** (this project moved from WSL2 to
  native Kubuntu partway through) — `venv/` and `node_modules/` are
  gitignored and do not transfer; both need a fresh `pip install -r
  requirements.txt` / `npm install` on the new machine. Confirmed
  Python version differences between machines (3.12 vs. 3.14) did not
  cause compatibility issues in practice, but is worth checking if
  something behaves unexpectedly after a machine switch.

## No `.env` for most credentials — deliberate

Only the frontend's `NEXT_PUBLIC_API_URL` lives in a `.env` file. The
OpenAI API key and WordPress credentials are stored in the database
(`AppCredential`, `WordPressIntegration`) and editable from the Settings
UI, fetched fresh per-call (`services/openai_client.py`) rather than
cached at process startup — changing the OpenAI key in Settings takes
effect on the very next request, no server restart required. This was a
deliberate correction partway through the project; the original version
read `OPENAI_API_KEY` from `.env` once at import time, which silently
continued using a stale key if changed via the (at-the-time nonfunctional)
Settings UI.

## Migrations are hand-written, not Alembic-managed

Every schema change so far has been applied via a one-off `sqlite3`
script (`ALTER TABLE ... ADD COLUMN`, or for constraint changes SQLite
can't do in place, a rename-create-copy-drop sequence) run manually
against `data.db`. `alembic` is listed as a dependency but has never
actually been used. This has worked for a single-developer, single-
database project, but is a real gap the moment more than one person or
environment needs to stay in sync — see the multi-user section below.

## What a multi-user version would need to change

This is scoped as a **separate future project** (a new repository), not
an incremental change to this one — but worth recording here what the
actual delta would be, based on what's already been learned:

- **Single-row tables become per-user tables.** `AppCredential` and
  `WordPressIntegration` were deliberately built as single-row (`id=1`)
  tables specifically so this migration is a matter of adding a
  `user_id` column and changing lookups from `.filter(id == 1)` to
  `.filter(user_id == current_user.id)` — not a structural rewrite.
- **SQLite → a real concurrent database (e.g. Postgres).** SQLite locks
  the whole file on write, which is fine for one person clicking around
  but a real bottleneck the moment multiple users hit the API
  simultaneously. Because every table access goes through SQLAlchemy's
  ORM (no raw SQL anywhere in the codebase), this swap is mostly a
  connection-string change plus adopting real Alembic migrations (see
  above) — not a rewrite of query logic.
- **Real authentication.** Currently none — anyone who can reach the
  backend can do anything. Every router assumes a single implicit user.
- **Per-user OpenAI/WordPress credentials**, following from the
  single-row-table point above — each user brings their own key/site,
  rather than one shared global configuration.
- **Site-scoping already generalizes correctly.** The `site_url` scoping
  added to `WordPressPublishedItem`/`WordPressCategoryTerm` (see
  `wordpress-integration.md`) means multiple users pushing to different
  WordPress sites already wouldn't collide with each other, even before
  any other multi-user work is done — this was fixed for a single-user-
  switching-sites scenario, but the same mechanism happens to cover the
  multi-user case too.

## Known operational limits

- Single-job generation only — one batch runs at a time, no queue
- No rate limiting or cost caps beyond the manual per-batch confirmation
  threshold in Settings (not yet enforced in the UI, per the README)
