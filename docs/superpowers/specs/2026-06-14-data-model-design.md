# Data Model — Design

**Date:** 2026-06-14
**Status:** Approved — persistence layer only (no route handlers, no contract changes)
**Builds on:** `docs/superpowers/specs/2026-06-14-cart-scaffold-design.md`

## Context

The scaffold left `apps/api/prisma/schema.prisma` with no models. This phase
defines the four entities, generates the initial migration, and writes an
idempotent seed. It is the persistence layer in isolation: the four cart APIs
and the frontend pages are later phases.

The schema must stay consistent with the already-committed `@cart/contracts`
shapes. This phase does **not** modify `@cart/contracts`.

## Goals

- A Prisma schema for `User`, `Product`, `Cart`, `CartItem` consistent with the
  contract.
- A committed, versioned initial migration (`prisma migrate`).
- An idempotent seed: one user (`id = "user-1"`) and 8 products across ≥3
  categories.
- A repository-level test proving the increment-not-duplicate constraint and the
  category boundary mapping.

## Non-goals (this phase)

- Route handler logic / the four cart APIs.
- Changes to `@cart/contracts`.
- Frontend work.
- Authentication beyond the existing fake `x-user-id` header seam.

## Decisions

| Topic | Decision |
| --- | --- |
| Money | `Int` cents (`priceCents`). No floats, no Decimal. |
| IDs | `@default(cuid())`, except the seed user which uses the literal `"user-1"`. |
| Category | Prisma enum with underscore members + a boundary map to/from the contract's hyphenated wire values. |
| Cart lifecycle | One cart per user (`Cart.userId @unique`), lazy-created. |
| Timestamps | `createdAt` + `updatedAt` on all four models. |
| Cascades | `Cart→CartItem` Cascade; `Cart→User` Cascade; `CartItem→Product` Restrict. |
| Schema delivery | `prisma migrate` (committed SQL migration). |

## The category enum mismatch

The contract `Category` Zod enum uses hyphenated values (`"dry-food"`,
`"wet-food"`). Prisma enum members must be valid identifiers and cannot contain
hyphens. Therefore the DB enum and the wire/contract enum cannot be identical
strings.

**Resolution (option A):** the Prisma enum uses underscores
(`dry_food`, `wet_food`, `treats`, `toys`, `healthcare`). A small bidirectional
map at the repository boundary converts DB ↔ contract. The public API and the
emitted OpenAPI document keep the brief's hyphenated values unchanged.

```ts
// apps/api/src/repositories/category-map.ts
import { Category as DbCategory } from "../generated/prisma/client.js";
import type { Category as WireCategory } from "@cart/contracts";

const toWire: Record<DbCategory, WireCategory> = {
  dry_food: "dry-food",
  wet_food: "wet-food",
  treats: "treats",
  toys: "toys",
  healthcare: "healthcare",
};
const fromWire = Object.fromEntries(
  Object.entries(toWire).map(([db, wire]) => [wire, db]),
) as Record<WireCategory, DbCategory>;

export const categoryToWire = (c: DbCategory): WireCategory => toWire[c];
export const categoryFromWire = (c: WireCategory): DbCategory => fromWire[c];
```

This map is the single place the two enums meet; if either list changes, the
`Record` types fail to compile until the map is updated.

## Schema

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
}

enum Category {
  dry_food
  wet_food
  treats
  toys
  healthcare
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  cart      Cart?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Product {
  id         String     @id @default(cuid())
  name       String
  priceCents Int
  category   Category
  cartItems  CartItem[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
}

model Cart {
  id        String     @id @default(cuid())
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId    String     @unique
  items     CartItem[]
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
}

model CartItem {
  id        String   @id @default(cuid())
  cart      Cart     @relation(fields: [cartId], references: [id], onDelete: Cascade)
  cartId    String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Restrict)
  productId String
  quantity  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([cartId, productId])
}
```

Note: SQLite has no native enum or `onDelete: Restrict` enforcement at the
engine level for every case; Prisma emulates enums as `TEXT` and enforces
referential actions in the query engine. This is acceptable and is part of why
the migration is committed (the same schema yields real constraints on Postgres).

## Relations

```
User (1) ──< (0..1) Cart ──< (n) CartItem >── (1) Product
```

- One `User` has at most one `Cart` (`Cart.userId @unique`).
- A `Cart` has many `CartItem`s.
- Each `CartItem` references exactly one `Product`.
- `@@unique([cartId, productId])` guarantees a product appears at most once per
  cart — the database-level backing for "increment, don't duplicate".

## Seed

`apps/api/prisma/seed.ts`, idempotent via `upsert`:

- **User:** `upsert` on `id = "user-1"` (matches the `DEV_USER_ID` in
  `apps/web/src/lib/api-client.ts`), name + a fixed email.
- **Products:** 8 items across 5 categories (≥3 required), `upsert` on stable
  literal ids so re-seeding is deterministic and idempotent. Prices in cents.
  Categories use the Prisma underscore members.
- **No cart** is seeded — carts are lazy-created.

Example product rows (final list authored in the plan):
`dry_food` × 2, `wet_food` × 2, `treats` × 2, `toys` × 1, `healthcare` × 1.

## Migration & client

- `prisma migrate dev --name init_cart_schema`, run with `DATABASE_URL` loaded
  from `apps/api/.env` (Prisma 7 config in `prisma.config.ts`).
- Commit the generated `apps/api/prisma/migrations/**` SQL.
- The regenerated client exposes the four models; `apps/api/src/db.ts` already
  instantiates `PrismaClient` via the better-sqlite3 adapter — no change needed.
- The generated client stays gitignored (regenerated on install/`db:generate`).

## Testing

Vitest, in `apps/api`:

1. **`@@unique([cartId, productId])` constraint** — insert a cart + product,
   create a `CartItem`, then attempt a second `CartItem` with the same
   `(cartId, productId)`; expect a Prisma unique-constraint violation
   (`P2002`). This proves the DB-level guarantee the future "add" handler will
   rely on (it will `upsert`/increment instead).
2. **Category boundary map round-trips** — for every contract `Category` value,
   `categoryToWire(categoryFromWire(v)) === v`, and the map is total over both
   enums (compile-time enforced by the `Record` types; runtime test asserts the
   five pairs).

Tests run against a real SQLite database created per run: a temp file under the
OS temp dir, schema applied via `prisma db push --skip-generate` against the
test `DATABASE_URL` in a Vitest `globalSetup` hook, then deleted in teardown.
`db push` (not `migrate deploy`) is used for tests because it needs no migration
history and is the faster, standard choice for an ephemeral test DB. The test
`DATABASE_URL` is isolated from dev (`apps/api/prisma/dev.db`).

## Files

```
apps/api/
├── prisma/
│   ├── schema.prisma                      # MODIFY: add enum + 4 models
│   ├── migrations/                        # CREATE: init_cart_schema (committed)
│   └── seed.ts                            # MODIFY: idempotent user + 8 products
└── src/
    └── repositories/
        ├── category-map.ts                # CREATE: DB↔wire category map
        └── category-map.test.ts           # CREATE: round-trip test
    └── __tests__/
        └── cart-item-unique.test.ts       # CREATE: @@unique constraint test
```

## Acceptance criteria

- `pnpm --filter @cart/api db:generate` regenerates a client with the four models.
- The initial migration exists under `prisma/migrations/` and is committed.
- `pnpm --filter @cart/api db:seed` is idempotent (running twice yields the same
  one user + 8 products, no duplicates).
- The two tests pass; `pnpm turbo lint typecheck test` stays green across all
  workspaces.
- No route-handler or `@cart/contracts` changes in this phase.
