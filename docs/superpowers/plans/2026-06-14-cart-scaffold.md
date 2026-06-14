# Shopping Cart Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a pnpm + Turborepo monorepo for a shopping cart (Hono API, Next.js web, shared `@cart/*` packages, full docs) that runs lint/typecheck/test green end-to-end, with **no feature logic implemented**.

**Architecture:** Contract-first plain REST. `@cart/contracts` (Zod schemas + inferred DTOs + error shape + route map + OpenAPI emitter) is the single shared dependency — no `hono/client`, no app→app edge. `apps/api` validates with `@hono/zod-validator`; `apps/web` calls a thin typed `fetch` wrapper. Prisma 7 + SQLite via a driver adapter, schema left empty. Vitest everywhere; GitHub Actions CI.

**Tech Stack:** pnpm 10, Turborepo 2.9, TypeScript 5, Hono 4.12 + `@hono/node-server` + `@hono/zod-validator` 0.8, Zod 4, Prisma 7 (`prisma-client` generator) + SQLite + `@prisma/adapter-better-sqlite3`, Next.js 16, Tailwind 4 (`@tailwindcss/postcss`, CSS-first), shadcn/ui (`--monorepo`), `@asteasolutions/zod-to-openapi` 8, Vitest 4.

**Reference spec:** `docs/superpowers/specs/2026-06-14-cart-scaffold-design.md`

> **Pinned versions** (verified 2026-06-14): `turbo@2.9`, `hono@4.12`, `@hono/zod-validator@0.8`, `zod@4`, `next@16`, `vitest@4`, `prisma@7`, `@prisma/client@7`, `@asteasolutions/zod-to-openapi@8`, `tailwindcss@4`. Node floor is 20.9 (Next 16). Use `^` ranges so patch updates flow.

---

## File Structure

```
tech-task-cart/
├── package.json                         # root: workspaces, turbo scripts, pnpm pkgManager
├── pnpm-workspace.yaml                  # apps/*, packages/*
├── turbo.json                           # task graph: lint, typecheck, test, build, dev
├── .nvmrc                               # 20.11.1
├── .gitignore                           # (exists)
├── README.md
├── AGENTS.md
├── CLAUDE.md                            # imports AGENTS.md
├── .github/workflows/ci.yml
├── packages/
│   ├── tsconfig/
│   │   ├── package.json                 # @cart/tsconfig
│   │   ├── base.json
│   │   ├── node.json
│   │   └── next.json
│   ├── eslint-config/
│   │   ├── package.json                 # @cart/eslint-config
│   │   └── index.js
│   ├── contracts/
│   │   ├── package.json                 # @cart/contracts
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── src/
│   │   │   ├── index.ts                  # barrel
│   │   │   ├── domain.ts                 # Product/Category/Cart/CartItem/User schemas (stub)
│   │   │   ├── errors.ts                 # ApiError shape + codes
│   │   │   ├── routes.ts                 # route path map
│   │   │   ├── openapi.ts                # registry + buildDocument()
│   │   │   └── contracts.test.ts         # sample test
│   │   └── scripts/generate-openapi.ts   # writes openapi.json
│   └── ui/
│       ├── package.json                 # @cart/ui  (shadcn target)
│       ├── components.json
│       ├── src/lib/utils.ts              # cn()
│       └── src/styles/globals.css        # @import "tailwindcss" + theme
├── apps/
│   ├── api/
│   │   ├── package.json                  # @cart/api
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   ├── .env.example                  # DATABASE_URL
│   │   ├── prisma/schema.prisma          # empty models
│   │   ├── src/
│   │   │   ├── app.ts                     # Hono app + onError + route stubs
│   │   │   ├── server.ts                  # serve()
│   │   │   ├── db.ts                       # PrismaClient + adapter (stub)
│   │   │   └── app.test.ts                 # sample test hitting a stub route
│   │   └── prisma/seed.ts                  # seed stub
│   └── web/
│       ├── package.json                  # @cart/web
│       ├── tsconfig.json
│       ├── next.config.ts
│       ├── postcss.config.mjs
│       ├── vitest.config.ts
│       ├── components.json
│       ├── app/layout.tsx
│       ├── app/page.tsx                   # placeholder shell
│       ├── app/globals.css
│       ├── src/lib/api-client.ts          # typed fetch wrapper (stub)
│       └── src/lib/api-client.test.ts     # sample test
```

---

## Task 1: Root workspace skeleton

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create `.nvmrc`**

```
20.11.1
```

- [ ] **Step 3: Create root `package.json`**

```json
{
  "name": "tech-task-cart",
  "private": true,
  "packageManager": "pnpm@10.33.0",
  "engines": { "node": ">=20.9" },
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "test": "turbo test"
  },
  "devDependencies": {
    "turbo": "^2.9.18",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json .nvmrc
git commit -m "chore: root turborepo workspace skeleton"
```

---

## Task 2: Shared tsconfig presets (`@cart/tsconfig`)

**Files:**
- Create: `packages/tsconfig/package.json`, `base.json`, `node.json`, `next.json`

- [ ] **Step 1: Create `packages/tsconfig/package.json`**

```json
{
  "name": "@cart/tsconfig",
  "version": "0.0.0",
  "private": true,
  "files": ["base.json", "node.json", "next.json"]
}
```

- [ ] **Step 2: Create `packages/tsconfig/base.json`**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "noEmit": true
  }
}
```

- [ ] **Step 3: Create `packages/tsconfig/node.json`**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "types": ["node"],
    "module": "ESNext",
    "moduleResolution": "Bundler"
  }
}
```

- [ ] **Step 4: Create `packages/tsconfig/next.json`**

```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "plugins": [{ "name": "next" }],
    "incremental": true
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/tsconfig
git commit -m "chore: shared tsconfig presets (@cart/tsconfig)"
```

---

## Task 3: Shared ESLint config (`@cart/eslint-config`)

**Files:**
- Create: `packages/eslint-config/package.json`, `index.js`

- [ ] **Step 1: Create `packages/eslint-config/package.json`**

```json
{
  "name": "@cart/eslint-config",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "index.js",
  "dependencies": {
    "typescript-eslint": "^8.18.0",
    "@eslint/js": "^9.17.0"
  }
}
```

- [ ] **Step 2: Create `packages/eslint-config/index.js`** (flat config preset)

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", ".next/**", "**/generated/**", "openapi.json"],
  },
);
```

- [ ] **Step 3: Commit**

```bash
git add packages/eslint-config
git commit -m "chore: shared eslint flat config (@cart/eslint-config)"
```

---

## Task 4: Contracts package — manifest, tsconfig, vitest

**Files:**
- Create: `packages/contracts/package.json`, `tsconfig.json`, `vitest.config.ts`

- [ ] **Step 1: Create `packages/contracts/package.json`**

```json
{
  "name": "@cart/contracts",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "generate:openapi": "tsx scripts/generate-openapi.ts"
  },
  "dependencies": {
    "zod": "^4.4.3",
    "@asteasolutions/zod-to-openapi": "^8.5.0"
  },
  "devDependencies": {
    "@cart/eslint-config": "workspace:*",
    "@cart/tsconfig": "workspace:*",
    "eslint": "^9.17.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Create `packages/contracts/tsconfig.json`**

```json
{
  "extends": "@cart/tsconfig/base.json",
  "include": ["src", "scripts"]
}
```

- [ ] **Step 3: Create `packages/contracts/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create `packages/contracts/eslint.config.js`**

```js
import config from "@cart/eslint-config";
export default config;
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/package.json packages/contracts/tsconfig.json packages/contracts/vitest.config.ts packages/contracts/eslint.config.js
git commit -m "chore: contracts package manifest and tooling"
```

---

## Task 5: Contracts — domain, errors, routes (stubs)

**Files:**
- Create: `packages/contracts/src/domain.ts`, `errors.ts`, `routes.ts`, `index.ts`

> These are **stubs** establishing the contract surface. Schemas declare the shape per the spec; no business logic. Feature phase fills in refinements.

- [ ] **Step 1: Create `packages/contracts/src/errors.ts`**

```ts
import { z } from "zod";

export const ApiErrorCode = z.enum([
  "VALIDATION_ERROR",
  "PRODUCT_NOT_FOUND",
  "CART_ITEM_NOT_FOUND",
  "INTERNAL_ERROR",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiErrorSchema = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
```

- [ ] **Step 2: Create `packages/contracts/src/domain.ts`**

```ts
import { z } from "zod";

export const Category = z.enum([
  "dry-food",
  "wet-food",
  "treats",
  "toys",
  "healthcare",
]);
export type Category = z.infer<typeof Category>;

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  priceCents: z.number().int().nonnegative(),
  category: Category,
});
export type Product = z.infer<typeof ProductSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
});
export type User = z.infer<typeof UserSchema>;

export const CartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});
export type CartItem = z.infer<typeof CartItemSchema>;

export const CartLineSchema = z.object({
  product: ProductSchema,
  quantity: z.number().int().positive(),
  lineSubtotalCents: z.number().int().nonnegative(),
});
export type CartLine = z.infer<typeof CartLineSchema>;

export const CartSchema = z.object({
  lines: z.array(CartLineSchema),
  grandTotalCents: z.number().int().nonnegative(),
});
export type Cart = z.infer<typeof CartSchema>;

export const AddCartItemSchema = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
});
export type AddCartItem = z.infer<typeof AddCartItemSchema>;

export const ProductListSchema = z.array(ProductSchema);
export type ProductList = z.infer<typeof ProductListSchema>;
```

- [ ] **Step 3: Create `packages/contracts/src/routes.ts`** (shared path map)

```ts
export const routes = {
  products: "/api/products",
  cart: "/api/cart",
  cartItems: "/api/cart/items",
  cartItem: (productId: string) => `/api/cart/items/${productId}`,
} as const;

export const USER_HEADER = "x-user-id";
```

- [ ] **Step 4: Create `packages/contracts/src/index.ts`** (barrel)

```ts
export * from "./domain.js";
export * from "./errors.js";
export * from "./routes.js";
export * from "./openapi.js";
```

> Note: `.js` specifiers with `moduleResolution: Bundler` resolve to the `.ts` source in this workspace; consumers import via the package's `src` entry.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/domain.ts packages/contracts/src/errors.ts packages/contracts/src/routes.ts packages/contracts/src/index.ts
git commit -m "feat(contracts): domain schemas, error shape, route map (stubs)"
```

---

## Task 6: Contracts — OpenAPI emitter + sample test

**Files:**
- Create: `packages/contracts/src/openapi.ts`, `scripts/generate-openapi.ts`, `src/contracts.test.ts`

- [ ] **Step 1: Create `packages/contracts/src/openapi.ts`**

```ts
import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { ProductSchema, CartSchema, AddCartItemSchema } from "./domain.js";
import { ApiErrorSchema } from "./errors.js";

export function buildOpenApiDocument() {
  const registry = new OpenAPIRegistry();
  registry.register("Product", ProductSchema);
  registry.register("Cart", CartSchema);
  registry.register("AddCartItem", AddCartItemSchema);
  registry.register("ApiError", ApiErrorSchema);

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: { title: "Cart API", version: "0.0.0" },
  });
}
```

- [ ] **Step 2: Create `packages/contracts/scripts/generate-openapi.ts`**

```ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildOpenApiDocument } from "../src/openapi.js";

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, "..", "openapi.json");
writeFileSync(outPath, JSON.stringify(buildOpenApiDocument(), null, 2) + "\n");
console.log(`Wrote ${outPath}`);
```

- [ ] **Step 3: Write the sample test `packages/contracts/src/contracts.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ProductSchema, routes, buildOpenApiDocument } from "./index.js";

describe("contracts", () => {
  it("validates a product", () => {
    const parsed = ProductSchema.parse({
      id: "p1",
      name: "Kibble",
      priceCents: 1999,
      category: "dry-food",
    });
    expect(parsed.priceCents).toBe(1999);
  });

  it("rejects negative price", () => {
    expect(() =>
      ProductSchema.parse({ id: "p1", name: "x", priceCents: -1, category: "toys" }),
    ).toThrow();
  });

  it("exposes a stable route map", () => {
    expect(routes.cartItem("p1")).toBe("/api/cart/items/p1");
  });

  it("builds an openapi document", () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.components?.schemas?.Product).toBeDefined();
  });
});
```

- [ ] **Step 4: Add `openapi.json` to gitignore** (generated artifact)

Append to `.gitignore`:
```
openapi.json
```

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/openapi.ts packages/contracts/scripts/generate-openapi.ts packages/contracts/src/contracts.test.ts .gitignore
git commit -m "feat(contracts): openapi emitter and sample tests"
```

---

## Task 7: Install deps and verify contracts run

**Files:** none (verification task)

- [ ] **Step 1: Install from root**

Run: `pnpm install`
Expected: resolves all workspaces, no errors.

- [ ] **Step 2: Typecheck + test contracts**

Run: `pnpm --filter @cart/contracts typecheck && pnpm --filter @cart/contracts test`
Expected: typecheck clean; 4 tests PASS.

- [ ] **Step 3: Generate OpenAPI**

Run: `pnpm --filter @cart/contracts generate:openapi`
Expected: prints `Wrote .../openapi.json`; file contains `"openapi": "3.0.0"` and a `Product` schema.

- [ ] **Step 4: Commit lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "chore: pnpm lockfile after contracts install"
```

---

## Task 8: API app — manifest, tsconfig, vitest, env

**Files:**
- Create: `apps/api/package.json`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `eslint.config.js`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@cart/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@cart/contracts": "workspace:*",
    "hono": "^4.12.25",
    "@hono/node-server": "^1.13.0",
    "@hono/zod-validator": "^0.8.0",
    "@prisma/client": "^7.8.0",
    "@prisma/adapter-better-sqlite3": "^7.8.0",
    "better-sqlite3": "^11.0.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@cart/eslint-config": "workspace:*",
    "@cart/tsconfig": "workspace:*",
    "@types/node": "^20.11.1",
    "eslint": "^9.17.0",
    "prisma": "^7.8.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "@cart/tsconfig/node.json",
  "compilerOptions": {
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/api/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 4: Create `apps/api/eslint.config.js`**

```js
import config from "@cart/eslint-config";
export default config;
```

- [ ] **Step 5: Create `apps/api/.env.example`**

```
DATABASE_URL="file:./dev.db"
PORT=8787
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json apps/api/tsconfig.json apps/api/vitest.config.ts apps/api/eslint.config.js apps/api/.env.example
git commit -m "chore(api): manifest and tooling"
```

---

## Task 9: API — Prisma 7 setup with empty schema

**Files:**
- Create: `apps/api/prisma/schema.prisma`, `apps/api/prisma/seed.ts`, `apps/api/src/db.ts`

- [ ] **Step 1: Create `apps/api/prisma/schema.prisma`** (empty models — Prisma 7 generator)

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

// Models are defined in the feature implementation phase:
// User, Product, Cart, CartItem (CartItem unique on [cartId, productId]).
```

- [ ] **Step 2: Create `apps/api/src/db.ts`** (adapter-based client stub)

```ts
import { PrismaBetterSQLite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client.js";

const adapter = new PrismaBetterSQLite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});

export const prisma = new PrismaClient({ adapter });
```

- [ ] **Step 3: Create `apps/api/prisma/seed.ts`** (stub)

```ts
// Seed script — implemented in the feature phase.
// Seeds one User and 6–10 Products across >=3 categories.
async function main() {
  console.log("seed: no-op in scaffold phase");
}

main();
```

- [ ] **Step 4: Add generated client to gitignore**

Append to `.gitignore`:
```
apps/api/src/generated/
apps/api/prisma/dev.db
```

- [ ] **Step 5: Generate the client**

Run: `cd apps/api && pnpm db:generate`
Expected: generates client into `src/generated/prisma`. (Empty models → a client with no model accessors; this is fine and compiles.)

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/seed.ts apps/api/src/db.ts .gitignore
git commit -m "chore(api): prisma 7 + sqlite adapter, empty schema"
```

---

## Task 10: API — Hono app with route stubs, error handler, server

**Files:**
- Create: `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/app.test.ts`

- [ ] **Step 1: Create `apps/api/src/app.ts`**

```ts
import { Hono } from "hono";
import { routes, type ApiError } from "@cart/contracts";

function notImplemented(): ApiError {
  return {
    error: { code: "INTERNAL_ERROR", message: "Not implemented" },
  };
}

export const app = new Hono()
  .get(routes.products, (c) => c.json(notImplemented(), 501))
  .get(routes.cart, (c) => c.json(notImplemented(), 501))
  .post(routes.cartItems, (c) => c.json(notImplemented(), 501))
  // Hono needs a `:param` pattern; routes.cartItem(id) builds concrete client paths.
  .delete(`${routes.cartItems}/:productId`, (c) => c.json(notImplemented(), 501));

app.onError((err, c) => {
  const body: ApiError = {
    error: { code: "INTERNAL_ERROR", message: err.message },
  };
  return c.json(body, 500);
});
```

- [ ] **Step 2: Create `apps/api/src/server.ts`**

```ts
import { serve } from "@hono/node-server";
import { app } from "./app.js";

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port });
console.log(`api listening on http://localhost:${port}`);
```

- [ ] **Step 3: Write sample test `apps/api/src/app.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { app } from "./app.js";
import { routes } from "@cart/contracts";

describe("api app", () => {
  it("returns a structured 501 for products (stub)", async () => {
    const res = await app.request(routes.products);
    expect(res.status).toBe(501);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter @cart/api test`
Expected: 1 test PASS.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @cart/api typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/app.ts apps/api/src/server.ts apps/api/src/app.test.ts
git commit -m "feat(api): hono app shell with route stubs and error handler"
```

---

## Task 11: UI package — shadcn target (`@cart/ui`)

**Files:**
- Create: `packages/ui/package.json`, `components.json`, `src/lib/utils.ts`, `src/styles/globals.css`

> Created manually to avoid interactive prompts. Mirrors what `shadcn init --monorepo` produces for the shared UI workspace.

- [ ] **Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@cart/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./lib/utils": "./src/lib/utils.ts",
    "./styles/globals.css": "./src/styles/globals.css",
    "./components/*": "./src/components/*.tsx"
  },
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.0",
    "lucide-react": "^0.469.0",
    "class-variance-authority": "^0.7.1"
  },
  "devDependencies": {
    "@cart/eslint-config": "workspace:*",
    "@cart/tsconfig": "workspace:*",
    "@types/react": "^19.0.0",
    "eslint": "^9.17.0",
    "react": "^19.0.0",
    "tailwindcss": "^4.3.1",
    "typescript": "^5.7.0"
  },
  "peerDependencies": { "react": "^19.0.0" }
}
```

- [ ] **Step 2: Create `packages/ui/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Create `packages/ui/src/styles/globals.css`** (Tailwind 4, CSS-first)

```css
@import "tailwindcss";

@theme inline {
  --color-background: #ffffff;
  --color-foreground: #0a0a0a;
}
```

- [ ] **Step 4: Create `packages/ui/tsconfig.json`**

```json
{
  "extends": "@cart/tsconfig/next.json",
  "include": ["src"]
}
```

- [ ] **Step 5: Create `packages/ui/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@cart/ui/components",
    "utils": "@cart/ui/lib/utils",
    "ui": "@cart/ui/components",
    "lib": "@cart/ui/lib",
    "hooks": "@cart/ui/hooks"
  }
}
```

- [ ] **Step 6: Create `packages/ui/eslint.config.js`**

```js
import config from "@cart/eslint-config";
export default config;
```

- [ ] **Step 7: Commit**

```bash
git add packages/ui
git commit -m "chore(ui): shadcn-compatible shared ui package"
```

---

## Task 12: Web app — Next.js 16 + Tailwind 4 manifest & config

**Files:**
- Create: `apps/web/package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `components.json`, `vitest.config.ts`, `eslint.config.js`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@cart/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@cart/contracts": "workspace:*",
    "@cart/ui": "workspace:*",
    "next": "^16.2.9",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@cart/eslint-config": "workspace:*",
    "@cart/tsconfig": "workspace:*",
    "@tailwindcss/postcss": "^4.3.1",
    "@types/node": "^20.11.1",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "eslint": "^9.17.0",
    "tailwindcss": "^4.3.1",
    "typescript": "^5.7.0",
    "vitest": "^4.1.8"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "@cart/tsconfig/next.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cart/ui", "@cart/contracts"],
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/web/postcss.config.mjs`**

```js
const config = {
  plugins: { "@tailwindcss/postcss": {} },
};
export default config;
```

- [ ] **Step 5: Create `apps/web/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@cart/ui/lib/utils",
    "ui": "@cart/ui/components",
    "lib": "@cart/ui/lib",
    "hooks": "@cart/ui/hooks"
  }
}
```

- [ ] **Step 6: Create `apps/web/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
});
```

- [ ] **Step 7: Create `apps/web/eslint.config.js`**

```js
import config from "@cart/eslint-config";
export default config;
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/tsconfig.json apps/web/next.config.ts apps/web/postcss.config.mjs apps/web/components.json apps/web/vitest.config.ts apps/web/eslint.config.js
git commit -m "chore(web): next.js 16 + tailwind 4 manifest and config"
```

---

## Task 13: Web app — placeholder shell + typed API client stub

**Files:**
- Create: `apps/web/app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `src/lib/api-client.ts`, `src/lib/api-client.test.ts`

- [ ] **Step 1: Create `apps/web/app/globals.css`**

```css
@import "tailwindcss";
```

- [ ] **Step 2: Create `apps/web/app/layout.tsx`**

```tsx
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Pet Circle Cart" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/page.tsx`** (placeholder shell)

```tsx
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Pet Circle Cart</h1>
      <p className="mt-2 text-neutral-600">Scaffold shell — features pending.</p>
    </main>
  );
}
```

- [ ] **Step 4: Create `apps/web/src/lib/api-client.ts`** (typed fetch wrapper stub)

```ts
import {
  ProductListSchema,
  CartSchema,
  routes,
  USER_HEADER,
  type ProductList,
  type Cart,
  type AddCartItem,
} from "@cart/contracts";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const DEV_USER_ID = "user-1";

async function request<T>(path: string, schema: { parse: (v: unknown) => T }, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", [USER_HEADER]: DEV_USER_ID, ...init?.headers },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}`);
  return schema.parse(json);
}

export const apiClient = {
  listProducts: (): Promise<ProductList> => request(routes.products, ProductListSchema),
  getCart: (): Promise<Cart> => request(routes.cart, CartSchema),
  addItem: (body: AddCartItem): Promise<Cart> =>
    request(routes.cartItems, CartSchema, { method: "POST", body: JSON.stringify(body) }),
  removeItem: (productId: string): Promise<Cart> =>
    request(routes.cartItem(productId), CartSchema, { method: "DELETE" }),
};
```

- [ ] **Step 5: Write sample test `apps/web/src/lib/api-client.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { routes, USER_HEADER } from "@cart/contracts";

describe("api-client wiring", () => {
  it("references the shared route map", () => {
    expect(routes.products).toBe("/api/products");
    expect(USER_HEADER).toBe("x-user-id");
  });
});
```

- [ ] **Step 6: Run the test**

Run: `pnpm --filter @cart/web test`
Expected: 1 test PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app apps/web/src
git commit -m "feat(web): placeholder shell and typed api client stub"
```

---

## Task 14: Full install + end-to-end toolchain verification

**Files:** none (verification task)

- [ ] **Step 1: Clean install**

Run: `pnpm install`
Expected: all 6 workspaces resolve, no peer-dep errors.

- [ ] **Step 2: Generate Prisma client (needed for api typecheck)**

Run: `pnpm --filter @cart/api db:generate`
Expected: client generated into `apps/api/src/generated/prisma`.

- [ ] **Step 3: Run the whole pipeline via turbo**

Run: `pnpm turbo lint typecheck test`
Expected: every workspace's `lint`, `typecheck`, `test` PASS (sample tests only).

- [ ] **Step 4: Boot the API and hit a stub**

Run (background): `pnpm --filter @cart/api dev`
Then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8787/api/products`
Expected: `501`. Stop the dev server afterward.

- [ ] **Step 5: Boot the web app**

Run (background): `pnpm --filter @cart/web dev`
Then: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`
Expected: `200`. Stop the dev server afterward.

- [ ] **Step 6: Commit lockfile if changed**

```bash
git add pnpm-lock.yaml
git commit -m "chore: lockfile after full workspace install" || echo "nothing to commit"
```

---

## Task 15: Docs — ADRs, pitfall, README, AGENTS.md, CLAUDE.md

**Files:**
- Create: `docs/adr/0001-monorepo-turborepo.md`, `0002-prisma-sqlite-over-in-memory.md`, `0003-rest-contract-over-hono-rpc.md`, `docs/pitfalls/currency-float-precision.md`, `README.md`, `AGENTS.md`, `CLAUDE.md`

- [ ] **Step 1: Create `docs/adr/0001-monorepo-turborepo.md`**

```markdown
# ADR 0001: Monorepo with Turborepo + pnpm

## Status
Accepted

## Context
Frontend and backend must be separate apps but share a domain contract. We want
one place for shared schemas/config and a single task runner for lint/test/build.

## Decision
Use a pnpm-workspace + Turborepo monorepo. Apps in `apps/*`, shared code in
`packages/*` (`@cart/contracts`, `@cart/ui`, `@cart/tsconfig`, `@cart/eslint-config`).

## Consequences
- One install, one task graph, cached builds.
- Shared contract enforced at compile time across apps.
- Slightly more upfront config than two separate repos — justified by the shared
  contract being the core of the design.
```

- [ ] **Step 2: Create `docs/adr/0002-prisma-sqlite-over-in-memory.md`**

```markdown
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
```

- [ ] **Step 3: Create `docs/adr/0003-rest-contract-over-hono-rpc.md`**

```markdown
# ADR 0003: Contract-first REST over Hono RPC

## Status
Accepted

## Context
Hono offers an RPC client (`hono/client`) giving end-to-end type inference by
importing the server's `AppType`. That couples a consumer to (a) being TypeScript
and (b) importing backend types — an app→app dependency.

## Decision
Expose a plain REST API. Put the contract (Zod schemas, inferred DTOs, error
shape, route path map) in `@cart/contracts`, depended on by both apps. The web
client is a thin typed `fetch` wrapper that validates responses with the shared
schemas. `@cart/contracts` emits an OpenAPI document for non-TS clients.

## Consequences
- No `hono/client`, no app→app edge. Hono becomes a swappable backend detail.
- A future mobile app (Swift/Kotlin) is a first-class client: it consumes the
  same REST contract / generated OpenAPI, not TS types.
- **Trade-off:** we lose automatic compile-time checking that a called
  path/method exists on the server. Mitigated by the shared route map both sides
  import, and runtime Zod validation of responses.
```

- [ ] **Step 4: Create `docs/pitfalls/currency-float-precision.md`**

```markdown
# Pitfall: Currency and float precision

## Problem
Representing money as floating-point (`19.99`) accumulates rounding error
(`0.1 + 0.2 !== 0.3`). Multiplying price × quantity and summing lines compounds it.

## Rule in this codebase
- Store and compute all money as **integer minor units (cents)**: `priceCents`,
  `lineSubtotalCents`, `grandTotalCents`.
- Never do arithmetic on a decimal dollar value.
- Convert to a display string (e.g. `$19.99`) only at the UI edge, via a single
  formatting helper.

## Where this is enforced
- `@cart/contracts` schemas use `z.number().int()` for all `*Cents` fields.
- The DB column is an integer.
```

- [ ] **Step 5: Create `AGENTS.md`**

```markdown
# AGENTS.md

Guidance for AI agents and humans working in this repository.

## What this is
A pet e-commerce shopping cart: separate backend and frontend in a monorepo.

## Layout
- `apps/api` — Hono REST backend. Validation via `@hono/zod-validator`. Prisma 7
  + SQLite (driver adapter). Structured errors via a Hono `onError` handler.
- `apps/web` — Next.js 16 frontend (App Router), Tailwind 4, shadcn/ui.
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
- Money is always integer cents. See `docs/pitfalls/currency-float-precision.md`.
- Types are inferred from Zod schemas, never hand-written.
- Commands: `pnpm turbo lint typecheck test` runs the whole pipeline.
- The current user is resolved from an `x-user-id` header (fake auth, seeded user).

## Commands
- Install: `pnpm install`
- Dev (all): `pnpm dev`  ·  API only: `pnpm --filter @cart/api dev`  ·  web only: `pnpm --filter @cart/web dev`
- Test / typecheck / lint: `pnpm turbo test` / `typecheck` / `lint`
- Prisma client: `pnpm --filter @cart/api db:generate`
- OpenAPI: `pnpm --filter @cart/contracts generate:openapi`
```

- [ ] **Step 6: Create `CLAUDE.md`** (imports AGENTS.md)

```markdown
@AGENTS.md
```

- [ ] **Step 7: Create `README.md`**

```markdown
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

## Getting started
```bash
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
```

- [ ] **Step 8: Add a placeholder to `docs/design-docs/`**

Create `docs/design-docs/README.md`:
```markdown
# Design Docs

Ongoing design documentation. The originating scaffold design lives at
`docs/superpowers/specs/2026-06-14-cart-scaffold-design.md`.
```

- [ ] **Step 9: Commit**

```bash
git add docs AGENTS.md CLAUDE.md README.md
git commit -m "docs: adrs, pitfall, readme, agents.md, claude.md"
```

---

## Task 16: CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.33.0
      - uses: actions/setup-node@v4
        with:
          node-version: 20.11.1
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @cart/api db:generate
      - run: pnpm turbo lint typecheck test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, typecheck, test via turbo"
```

---

## Task 17: Final end-to-end verification

**Files:** none (verification task)

- [ ] **Step 1: Fresh clean check**

Run:
```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules
pnpm install
pnpm --filter @cart/api db:generate
pnpm turbo lint typecheck test
```
Expected: install clean; all tasks PASS across all 6 workspaces.

- [ ] **Step 2: Confirm OpenAPI emits**

Run: `pnpm --filter @cart/contracts generate:openapi`
Expected: `apps`/`packages/contracts/openapi.json` written with `"openapi": "3.0.0"`.

- [ ] **Step 3: Confirm both apps boot** (per Task 14 steps 4–5).

- [ ] **Step 4: Confirm no feature logic leaked in**

Verify route handlers still return `501` stubs and the Prisma schema has no models.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: scaffold complete — green pipeline, no feature logic" || echo "clean"
```

---

## Notes for the implementer

- **Node floor:** Next 16 needs Node ≥20.9; the repo pins 20.11.1 via `.nvmrc`. If `pnpm install` warns about engines, run under the pinned Node.
- **Prisma import path** tracks the `output` in `schema.prisma`: `output = "../src/generated/prisma"` → import from `./generated/prisma/client`. With empty models the client compiles but exposes no model accessors — expected this phase.
- **`.js` import specifiers in TS source** are correct under `moduleResolution: "Bundler"` / NodeNext ESM and resolve to the `.ts` files; do not "fix" them to extensionless.
- **shadcn components:** to add a real component later, run `pnpm dlx shadcn@latest add button` from `apps/web` (it installs into `@cart/ui` per the monorepo aliases). Not needed for the scaffold.
- **Do not implement business logic.** The scaffold is done when the pipeline is green, both apps boot, and handlers are still `501` stubs.
```
