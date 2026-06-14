# ADR 0002: Prisma + SQLite instead of in-memory state

## Status
Accepted

## Context
The brief permits in-memory state and warns against over-engineering. We chose a
real persistence layer anyway.

## Decision
Use Prisma 7 with a SQLite datasource via a driver adapter
(`@prisma/adapter-better-sqlite3`).

## Consequences
- Demonstrates a real persistence seam and migration story.
- Swapping to Postgres for production is a datasource/adapter change, not a
  rewrite — the repository boundary stays identical.
- **Trade-off / deliberate over-scope:** more than the brief requires. Cost is
  extra setup and a generated client. Defensible because it makes the
  "scale to production" conversation concrete; to be called out in the walkthrough.
- If time-constrained, an in-memory repository implementing the same interface
  would be a drop-in alternative.

## Implementation notes (Prisma 7 specifics)
- Prisma 7 removed `url` from the `datasource` block. Connection config lives in
  `apps/api/prisma.config.ts` (`datasource.url` via `env()`); the runtime client
  connects through the driver adapter, not a datasource URL.
- The generator is `provider = "prisma-client"` with a required `output` path;
  the client is imported from that path, not `@prisma/client`.
- `better-sqlite3` must match the adapter's required range (`^12.6.0`). Its
  native build is approved via `onlyBuiltDependencies` in `pnpm-workspace.yaml`.
- See `docs/pitfalls/` for the gotchas encountered.
