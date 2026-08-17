# Documentation

Developer/architecture documentation for the Coloring Book Generator.
This is the "why" layer — for the "what" (exact API request/response
shapes), use the auto-generated interactive docs at
`http://localhost:8000/docs` while the backend is running.

- [Architecture Overview](./architecture.md) — how the pieces fit together
- [Data Model](./data-model.md) — every table, what it's for, how they relate
- [WordPress Integration](./wordpress-integration.md) — REST quirks, site-scoping, Polylang, Elementor gotcha
- [SEO Content Pipeline](./seo-pipeline.md) — how title/alt/excerpt/content generation and caching works
- [Generation & Publishing Pipeline](./generation-publishing.md) — prompt → image → review → local publish
- [Environment & Deployment Notes](./environment-deployment.md) — setup quirks, multi-user considerations
- [Decision Log](./decision-log.md) — deliberate tradeoffs and known debt, kept current
