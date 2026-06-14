# Pet Circle — Shopping Cart

A shopping cart for a pet e-commerce store, built as a Turborepo monorepo with a
separate backend and frontend sharing one typed contract.

## Stack
- **Monorepo:** pnpm workspaces + Turborepo
- **Backend:** Hono + `@hono/zod-validator`, Prisma 7 + SQLite (driver adapter)
- **Frontend:** Next.js 16 (App Router), Tailwind 4, shadcn/ui
- **Contract:** `@cart/contracts` — Zod schemas, inferred types, route map,
  OpenAPI emitter (single source of truth for both apps)
- **Tests:** Vitest

## Architecture
Contract-first plain REST. The frontend and backend share **only**
`@cart/contracts` — there is no framework-level RPC coupling. See
[ADR 0003](docs/adr/0003-rest-contract-over-hono-rpc.md).

## Requirements
- **Node 22** (`nvm use` reads `.nvmrc`). pnpm 10.

## Getting started
```bash
nvm use
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm --filter @cart/api db:generate
pnpm dev
```
API: http://localhost:8787 · Web: http://localhost:3000

## Quality gate
```bash
pnpm turbo lint typecheck test
```

## Docs
- `docs/adr/` — decision records
- `docs/pitfalls/` — known pitfalls
- `docs/design-docs/`, `docs/superpowers/` — design and plan
- See `AGENTS.md` for the full repo guide.

## Scope
Scaffold + (later) the four cart APIs and two pages from the brief. Auth,
payments, inventory and checkout are intentionally out of scope.
