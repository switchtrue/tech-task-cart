# Shopping Cart — Scaffold Design

**Date:** 2026-06-14
**Status:** Approved — scaffold only (no feature implementation)

## Context

A take-home task: build a shopping cart for a pet e-commerce store, with a
separate frontend and backend. The brief (Pet Circle, Senior Engineer) values
senior-level judgement, clean separation of concerns, engineering hygiene
(input validation, currency/float precision, consistent API error structure),
and tests. The brief explicitly permits in-memory state and warns against
over-engineering.

This document covers **scaffolding only**. No business logic is implemented:
configs, manifests, an empty Prisma schema, route stubs, and sample tests are
produced so the project runs end-to-end (lint/typecheck/test green) from day
one. Feature implementation is a later phase.

### Deliberate deviations from the brief (to be defended)

- **Prisma + SQLite instead of in-memory state.** The brief allows in-memory.
  We go further to demonstrate a real persistence seam and a concrete
  "swap to a production database" story. Recorded in
  [ADR 0002](../adr/0002-prisma-sqlite-over-in-memory.md).
- **A `User` entity.** Not required by the brief. Added as a minimal, seeded
  record resolved via a fake auth header, to create a realistic
  "cart belongs to a user" boundary without building authentication.

## Goals

- A pnpm + Turborepo monorepo with cleanly separated apps and shared packages.
- End-to-end type safety via a **contract-first, plain-REST** approach — no
  framework-level RPC coupling between frontend and backend.
- A single source of truth for the domain contract (`@cart/contracts`) that is
  client-agnostic and can emit an OpenAPI document for non-TypeScript clients.
- Docs-in-code: ADRs, pitfalls, design docs, README, AGENTS.md, CLAUDE.md.
- Vitest configured everywhere with sample tests; CI running lint/typecheck/test.

## Non-goals (this phase)

- Any cart/product business logic (route handlers return typed `501` stubs).
- Authentication, payments, inventory, checkout.
- A populated Prisma schema or migrations (datasource + client generation only).

## Repository layout

```
tech-task-cart/
├── apps/
│   ├── api/                  # Hono backend
│   └── web/                  # Next.js frontend (shadcn + tailwind)
├── packages/
│   ├── contracts/            # Zod schemas, inferred DTOs, error shape,
│   │                         #   route path map, OpenAPI emitter
│   ├── tsconfig/             # shared tsconfig presets (base, next, node)
│   └── eslint-config/        # shared eslint preset
├── docs/
│   ├── adr/
│   ├── pitfalls/
│   ├── design-docs/
│   └── superpowers/specs/    # this spec
├── .github/workflows/ci.yml
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── README.md
├── AGENTS.md
└── CLAUDE.md                 # imports AGENTS.md
```

## Type architecture: contract-first, plain REST

The frontend and backend share exactly one dependency: `@cart/contracts`.
There is **no `hono/client`** and **no app→app dependency edge** in either
direction. Hono is purely a backend implementation detail and can be swapped
without touching the web app.

`@cart/contracts` owns:

- **Zod schemas** for every request and response, plus the domain types
  (`Product`, `Category` enum, `Cart`, `CartItem`, `User`).
- **Inferred TypeScript types** (`z.infer`), never hand-written.
- **The structured error shape** (`{ error: { code, message, details? } }`).
- **A route path map** — path/method constants both sides reference, so the
  web client and server agree on routes without RPC inference.
- **An OpenAPI emitter** — a `generate:openapi` script (zod-to-openapi) writing
  `openapi.json`, so future non-TS clients (e.g. a mobile app) can codegen.

Data flow:

- `apps/api` imports schemas from `@cart/contracts`, validates requests at the
  edge with `@hono/zod-validator`, and types handler responses against the
  inferred DTOs.
- `apps/web` imports the inferred DTOs + route map from `@cart/contracts` and
  calls the API through a thin typed `fetch` wrapper (`apiClient`). It may
  re-validate responses with the same Zod schemas as a defensive boundary.

Rationale recorded in
[ADR 0003](../adr/0003-rest-contract-over-hono-rpc.md). The trade-off: we lose
automatic compile-time checking that a called path/method exists on the server
(mitigated by the shared route map); we gain a client-agnostic API and a clean
dependency graph.

## Data model

Committed here; the Prisma schema file is left empty this phase.

- **User** — `id`, `name`, `email`. One record seeded. The API resolves the
  current user from a fake `x-user-id` header that defaults to the seeded user.
- **Product** — `id`, `name`, `price` (**integer minor units / cents**),
  `category` (enum: `dry-food`, `wet-food`, `treats`, `toys`, `healthcare`).
  Seeded with 6–10 products across ≥3 categories.
- **Cart** — `id`, `userId`. One active cart per user.
- **CartItem** — `id`, `cartId`, `productId`, `quantity`. **Unique on
  `(cartId, productId)`** so adding an existing product increments the quantity
  rather than creating a duplicate line.

**Currency precision:** prices and totals are integer cents end-to-end; never
floating point. Formatting to a display string happens only at the edge.
Recorded in [pitfalls/currency-float-precision](../pitfalls/currency-float-precision.md).

## API surface

Plain REST returning JSON validated against `@cart/contracts`.

| Method   | Path                          | Purpose                                              |
| -------- | ----------------------------- | ---------------------------------------------------- |
| `GET`    | `/api/products`               | Full product list.                                   |
| `GET`    | `/api/cart`                   | Current cart: line items, per-line subtotal, grand total. |
| `POST`   | `/api/cart/items`             | Add product (`{ productId, quantity }`); increments if present. |
| `DELETE` | `/api/cart/items/:productId`  | Remove a line item entirely.                         |

### Validation & errors

- `@hono/zod-validator` on params/body.
- Unknown product ID → 4xx with a structured error.
- Non-positive quantity → 4xx with a structured error.
- One consistent error shape (`{ error: { code, message, details? } }`),
  defined in `@cart/contracts` and emitted by a Hono `onError` handler.
- The frontend surfaces errors meaningfully — no silent failures.

## Testing & CI

- **Vitest** configured in `apps/api`, `apps/web`, and `packages/contracts`.
- One sample passing test per workspace so `turbo test` is green immediately.
- **`.github/workflows/ci.yml`** runs `turbo lint typecheck test` on push/PR.

## Docs seeded at scaffold time

- `docs/adr/0001-monorepo-turborepo.md`
- `docs/adr/0002-prisma-sqlite-over-in-memory.md` (records the deliberate
  over-scope vs. the brief and the swap-to-production-DB rationale)
- `docs/adr/0003-rest-contract-over-hono-rpc.md` (decoupling clients from the
  server framework; OpenAPI/mobile rationale)
- `docs/pitfalls/currency-float-precision.md`
- `docs/design-docs/` — home for ongoing design docs; this spec is the seed.

## Scaffold acceptance criteria

- `pnpm install` succeeds at the root.
- `pnpm turbo lint typecheck test` passes (sample tests, no real logic).
- `apps/api` boots and route stubs respond with typed `501` placeholders.
- `apps/web` boots and renders a placeholder shell (shadcn + tailwind wired).
- `pnpm --filter @cart/contracts generate:openapi` produces `openapi.json`.
- No feature/business logic present.
