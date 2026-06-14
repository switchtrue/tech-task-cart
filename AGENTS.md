# AGENTS.md

Guidance for AI agents and humans working in this repository.

## What this is
A pet e-commerce shopping cart: separate backend and frontend in a monorepo.
Built as a take-home task; the design/plan artifacts are committed under
`docs/superpowers/` as a record of the AI-assisted process.

## Layout
- `apps/api` — Hono REST backend. Validation via `@hono/zod-validator`. Prisma 7
  + SQLite (driver adapter). Structured errors via a Hono `onError` handler.
- `apps/web` — Next.js 16 frontend (App Router), Tailwind 4, shadcn/ui. The typed
  `fetch` client lives at `src/lib/api-client.ts` (private to the web app).
- `packages/contracts` — **single source of truth** for the API contract: Zod
  schemas, inferred types, error shape, route map, OpenAPI emitter. Both apps
  depend only on this. No `hono/client`, no app→app dependency.
- `packages/ui` — shared shadcn components (`@cart/ui`).
- `packages/tsconfig`, `packages/eslint-config` — shared tooling presets.

## Docs structure
- `docs/adr/` — architectural decision records (numbered).
- `docs/pitfalls/` — known pitfalls and the rules that avoid them.
- `docs/design-docs/` — design docs.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — the AI-assisted
  brainstorm spec and implementation plan for this task.

## Conventions
- **Node 22** is required (`nvm use` reads `.nvmrc` = 22.18.0). Vitest 4 needs
  Node 20.12+. See `docs/pitfalls/node-version-floor.md`.
- Money is always integer cents. See `docs/pitfalls/currency-float-precision.md`.
- Types are inferred from Zod schemas, never hand-written.
- Schema modules import `z` from `contracts/src/zod-openapi.ts` (not `zod`) so the
  OpenAPI extension applies. See `docs/pitfalls/zod-openapi-extend-order.md`.
- The current user is resolved from an `x-user-id` header (fake auth, seeded user).

## Commands
- Install: `pnpm install`
- Dev (all): `pnpm dev`  ·  API only: `pnpm --filter @cart/api dev`  ·  web only: `pnpm --filter @cart/web dev`
- Quality gate: `pnpm turbo lint typecheck test`
- Prisma: `db:generate` (client), `db:migrate` (author/apply a migration in dev),
  `db:deploy` (apply migrations in prod/CI), `db:reset` (drop + re-migrate + seed),
  `db:seed`, `db:push` (schema → DB, no migration; used by tests). All under
  `pnpm --filter @cart/api`.
- OpenAPI: `pnpm --filter @cart/contracts generate:openapi`

## Status
Backend cart APIs implemented: `GET /products`, `GET /cart`,
`POST /cart/items` (increment-on-duplicate), `DELETE /cart/items/:productId`,
through a thin-route → cart-service → repository layering with integer-cents
totals, structured errors (`ApiException` + `onError`), and an `x-user-id`
middleware on cart routes. Unit + integration tested (23 tests). The frontend
(product list + cart view) is the next phase. See `docs/superpowers/plans/`.
