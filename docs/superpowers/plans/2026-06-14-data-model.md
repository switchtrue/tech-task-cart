# Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define the Prisma schema for `User`/`Product`/`Cart`/`CartItem`, generate a committed migration, write an idempotent seed, and add the category boundary map — all DB-backed and tested.

**Architecture:** Persistence layer only. Prisma 7 + SQLite (better-sqlite3 adapter). Money as `Int` cents, `cuid()` ids (seed user uses literal `"user-1"`). Prisma `Category` enum uses underscore members; a bidirectional boundary map converts to/from the contract's hyphenated wire values. `@@unique([cartId, productId])` backs increment-not-duplicate. No route handlers, no `@cart/contracts` changes.

**Tech Stack:** Prisma 7 (`prisma-client` generator), SQLite, `@prisma/adapter-better-sqlite3`, Vitest 4, Node 22.

**Reference spec:** `docs/superpowers/specs/2026-06-14-data-model-design.md`

> **Environment:** Run everything under Node 22 (`nvm use` in repo root reads `.nvmrc` → 22.18.0). All commands assume repo root unless stated. `apps/api/.env` must exist with `DATABASE_URL="file:./dev.db"` (copy from `.env.example` if missing).

---

## File Structure

```
apps/api/
├── prisma/
│   ├── schema.prisma                         # MODIFY: enum + 4 models
│   ├── migrations/20260614_init_cart_schema/ # CREATE (generated, committed)
│   │   └── migration.sql
│   ├── migrations/migration_lock.toml        # CREATE (generated, committed)
│   └── seed.ts                               # MODIFY: idempotent user + 8 products
└── src/
    ├── generated/prisma/**                   # regenerated (gitignored)
    ├── repositories/
    │   ├── category-map.ts                   # CREATE: DB↔wire category map
    │   └── category-map.test.ts              # CREATE: round-trip test
    └── test/
        ├── global-setup.ts                   # CREATE: per-run SQLite test DB
        └── db.test.ts                        # CREATE: @@unique constraint test
```

---

## Task 1: Define the Prisma schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [ ] **Step 1: Replace the model section of `apps/api/prisma/schema.prisma`**

Keep the existing `generator` and `datasource` blocks. Replace everything after
the `datasource db { ... }` block (the comment placeholder) with:

```prisma
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

- [ ] **Step 2: Validate and format the schema**

Run: `pnpm --filter @cart/api exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

Run: `pnpm --filter @cart/api exec prisma format`
Expected: rewrites with aligned columns, exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma
git commit -m "feat(api): define User/Product/Cart/CartItem prisma schema"
```

---

## Task 2: Generate the committed migration + client

**Files:**
- Create: `apps/api/prisma/migrations/**` (generated)

- [ ] **Step 1: Ensure `.env` exists**

Run: `test -f apps/api/.env || cp apps/api/.env.example apps/api/.env`
Expected: no output (file present).

- [ ] **Step 2: Create the initial migration and apply it to dev.db**

Run: `pnpm --filter @cart/api exec prisma migrate dev --name init_cart_schema`
Expected: creates `prisma/migrations/<timestamp>_init_cart_schema/migration.sql`,
applies it, and regenerates the client. Output ends with
`Your database is now in sync with your schema.` and
`Generated Prisma Client`.

- [ ] **Step 3: Confirm the migration SQL contains the unique index**

Run: `grep -r "cartId" apps/api/prisma/migrations/*/migration.sql | head`
Expected: a `CREATE UNIQUE INDEX` line over `cartId`, `productId`.

- [ ] **Step 4: Confirm the client now exposes the models**

Run: `pnpm --filter @cart/api exec node --input-type=module -e "import { PrismaClient, Category } from './src/generated/prisma/client.js'; console.log(typeof PrismaClient, Object.keys(Category));"`
Expected: prints `function` and `[ 'dry_food', 'wet_food', 'treats', 'toys', 'healthcare' ]`.

- [ ] **Step 5: Commit the migration (generated client stays gitignored)**

```bash
git add apps/api/prisma/migrations
git commit -m "feat(api): initial cart schema migration"
```

---

## Task 3: Category boundary map (TDD)

**Files:**
- Create: `apps/api/src/repositories/category-map.ts`
- Create: `apps/api/src/repositories/category-map.test.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/repositories/category-map.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { Category as WireCategoryEnum } from "@cart/contracts";
import { categoryToWire, categoryFromWire } from "./category-map.js";

describe("category-map", () => {
  it("round-trips every contract category value", () => {
    for (const wire of WireCategoryEnum.options) {
      expect(categoryToWire(categoryFromWire(wire))).toBe(wire);
    }
  });

  it("maps underscores to hyphens for compound names", () => {
    expect(categoryToWire(categoryFromWire("dry-food"))).toBe("dry-food");
    expect(categoryFromWire("wet-food")).toBe("wet_food");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @cart/api exec vitest run src/repositories/category-map.test.ts`
Expected: FAIL — `Cannot find module './category-map.js'` (or "categoryToWire is not a function").

- [ ] **Step 3: Implement `apps/api/src/repositories/category-map.ts`**

```ts
import { Category as DbCategory } from "../generated/prisma/client.js";
import type { Category as WireCategory } from "@cart/contracts";

const toWire: Record<DbCategory, WireCategory> = {
  [DbCategory.dry_food]: "dry-food",
  [DbCategory.wet_food]: "wet-food",
  [DbCategory.treats]: "treats",
  [DbCategory.toys]: "toys",
  [DbCategory.healthcare]: "healthcare",
};

const fromWire = Object.fromEntries(
  Object.entries(toWire).map(([db, wire]) => [wire, db]),
) as Record<WireCategory, DbCategory>;

export const categoryToWire = (c: DbCategory): WireCategory => toWire[c];
export const categoryFromWire = (c: WireCategory): DbCategory => fromWire[c];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @cart/api exec vitest run src/repositories/category-map.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @cart/api typecheck`
Expected: clean. (If `Category` is exported as a type-only value, the
`DbCategory.dry_food` member access confirms it's a runtime enum — the generated
Prisma client exports it as a value object.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/repositories/category-map.ts apps/api/src/repositories/category-map.test.ts
git commit -m "feat(api): category DB-to-wire boundary map"
```

---

## Task 4: Idempotent seed

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Replace `apps/api/prisma/seed.ts`**

```ts
import { existsSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Category } from "../src/generated/prisma/client.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const SEED_USER_ID = "user-1";

const products: ReadonlyArray<{
  id: string;
  name: string;
  priceCents: number;
  category: Category;
}> = [
  { id: "prod-dry-salmon", name: "Salmon Adult Dry Dog Food 3kg", priceCents: 4999, category: Category.dry_food },
  { id: "prod-dry-chicken", name: "Chicken & Rice Dry Cat Food 2kg", priceCents: 3499, category: Category.dry_food },
  { id: "prod-wet-beef", name: "Beef Casserole Wet Dog Food 400g x12", priceCents: 2899, category: Category.wet_food },
  { id: "prod-wet-tuna", name: "Tuna Pate Wet Cat Food 85g x24", priceCents: 3199, category: Category.wet_food },
  { id: "prod-treat-dental", name: "Dental Sticks 7-pack", priceCents: 899, category: Category.treats },
  { id: "prod-treat-jerky", name: "Chicken Jerky Treats 250g", priceCents: 1499, category: Category.treats },
  { id: "prod-toy-rope", name: "Tug Rope Dog Toy", priceCents: 1299, category: Category.toys },
  { id: "prod-health-flea", name: "Flea & Tick Spot-On 3-month", priceCents: 4599, category: Category.healthcare },
];

async function main() {
  await prisma.user.upsert({
    where: { id: SEED_USER_ID },
    update: { name: "Demo User", email: "demo@petcircle.test" },
    create: { id: SEED_USER_ID, name: "Demo User", email: "demo@petcircle.test" },
  });

  for (const p of products) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: { name: p.name, priceCents: p.priceCents, category: p.category },
      create: p,
    });
  }

  const [users, count] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
  ]);
  console.log(`seed complete: ${users} user(s), ${count} product(s)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Run the seed**

Run: `pnpm --filter @cart/api db:seed`
Expected: `seed complete: 1 user(s), 8 product(s)`.

- [ ] **Step 3: Run the seed again to verify idempotency**

Run: `pnpm --filter @cart/api db:seed`
Expected: still `seed complete: 1 user(s), 8 product(s)` (no duplicates, no errors).

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/seed.ts
git commit -m "feat(api): idempotent seed — demo user and 8 products"
```

---

## Task 5: Per-run test database setup

**Files:**
- Create: `apps/api/src/test/global-setup.ts`
- Modify: `apps/api/vitest.config.ts`

> Tests that hit the DB need a real, isolated SQLite file applied with the
> current schema. `globalSetup` provisions one temp DB for the whole run via
> `prisma db push`, exposes its URL through an env var, and deletes it in teardown.

- [ ] **Step 1: Create `apps/api/src/test/global-setup.ts`**

```ts
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let dir: string;

export function setup() {
  dir = mkdtempSync(join(tmpdir(), "cart-test-"));
  const dbUrl = `file:${join(dir, "test.db")}`;
  process.env.DATABASE_URL = dbUrl;
  execFileSync(
    "pnpm",
    ["exec", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    { env: { ...process.env, DATABASE_URL: dbUrl }, stdio: "inherit" },
  );
}

export function teardown() {
  rmSync(dir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Modify `apps/api/vitest.config.ts` to register globalSetup and pass env to tests**

Replace the file contents with:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    fileParallelism: false,
  },
});
```

> `fileParallelism: false` keeps DB-touching test files serial against the single
> shared test database, avoiding cross-file write races. The category-map test is
> pure and unaffected.

- [ ] **Step 3: Verify existing tests still pass under the new config**

Run: `pnpm --filter @cart/api test`
Expected: the existing `app.test.ts` (1) and `category-map.test.ts` (2) PASS;
`globalSetup` runs `prisma db push` once at the start (you'll see its output).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/test/global-setup.ts apps/api/vitest.config.ts
git commit -m "test(api): per-run sqlite test database via globalSetup"
```

---

## Task 6: `@@unique([cartId, productId])` constraint test (TDD)

**Files:**
- Create: `apps/api/src/test/db.test.ts`

> This test proves the database-level guarantee the future "add to cart" handler
> will rely on: a product can appear at most once per cart, so the handler must
> increment rather than insert a duplicate.

- [ ] **Step 1: Write the test `apps/api/src/test/db.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Category } from "../generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

async function fixture() {
  const user = await prisma.user.create({
    data: { name: "T", email: "t@test.local" },
  });
  const cart = await prisma.cart.create({ data: { userId: user.id } });
  const product = await prisma.product.create({
    data: { name: "Kibble", priceCents: 1999, category: Category.dry_food },
  });
  return { cart, product };
}

describe("CartItem @@unique([cartId, productId])", () => {
  it("rejects a duplicate (cartId, productId) with P2002", async () => {
    const { cart, product } = await fixture();
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });

    await expect(
      prisma.cartItem.create({
        data: { cartId: cart.id, productId: product.id, quantity: 1 },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("allows the same product in a different cart", async () => {
    const { cart, product } = await fixture();
    const user2 = await prisma.user.create({
      data: { name: "U2", email: "u2@test.local" },
    });
    const cart2 = await prisma.cart.create({ data: { userId: user2.id } });

    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: product.id, quantity: 1 },
    });
    const second = await prisma.cartItem.create({
      data: { cartId: cart2.id, productId: product.id, quantity: 2 },
    });

    expect(second.quantity).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify behaviour**

Run: `pnpm --filter @cart/api exec vitest run src/test/db.test.ts`
Expected: PASS (2 tests). The first asserts the unique violation (`P2002`); the
second confirms the constraint is scoped per-cart.

> If the first test FAILS because no error is thrown, the `@@unique` index is
> missing from the schema/migration — return to Task 1/2. If it fails with a
> different error code, inspect the thrown error; Prisma unique violations are
> `P2002`.

- [ ] **Step 3: Run the full API test file set**

Run: `pnpm --filter @cart/api test`
Expected: `app.test.ts` (1), `category-map.test.ts` (2), `db.test.ts` (2) all PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/test/db.test.ts
git commit -m "test(api): prove @@unique(cartId, productId) constraint"
```

---

## Task 7: Full pipeline verification + docs touch-up

**Files:**
- Modify: `AGENTS.md` (status line)

- [ ] **Step 1: Run the whole pipeline**

Run: `pnpm turbo lint typecheck test`
Expected: all workspaces PASS. The api `test` task provisions the temp DB via
globalSetup and runs 5 tests total.

- [ ] **Step 2: Confirm a clean regenerate still works (fresh client)**

Run: `rm -rf apps/api/src/generated && pnpm --filter @cart/api db:generate && pnpm --filter @cart/api typecheck`
Expected: client regenerates; typecheck clean. (Confirms nothing depends on
stale generated output.)

- [ ] **Step 3: Update the status section of `AGENTS.md`**

Replace the `## Status` section with:

```markdown
## Status
Data model implemented: User/Product/Cart/CartItem schema, committed initial
migration, idempotent seed (demo user `user-1` + 8 products), category DB↔wire
boundary map, and DB-backed tests for the `@@unique(cartId, productId)`
constraint. Route handlers still return `501` stubs — the four cart APIs are the
next phase. See `docs/superpowers/plans/`.
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs: mark data model phase complete in AGENTS.md"
```

---

## Notes for the implementer

- **Node 22 only.** `nvm use` first. The shell may default to an older Node.
- **`migrate dev` vs `db push`:** dev/prod schema delivery uses the committed
  migration (`migrate dev` once to author it). Tests use `db push` against a
  throwaway DB — no migration history needed, faster.
- **The category map is the only logic here.** Its `Record<DbCategory, …>` /
  `Record<WireCategory, …>` types are total: adding a category to either enum
  breaks compilation until the map is updated. That is intentional.
- **Generated client is gitignored** (`apps/api/src/generated/`). Only the
  schema and `prisma/migrations/**` are committed.
- **Do not touch `@cart/contracts` or route handlers** in this phase. The wire
  contract is unchanged; only the persistence layer and its internal mapping are
  added.
- **`process.env.DATABASE_URL!` in tests** is populated by globalSetup before any
  test file imports run. If a DB test errors with "no such table", globalSetup's
  `db push` didn't run or the env var didn't propagate — check `vitest.config.ts`
  registered `globalSetup`.
```
