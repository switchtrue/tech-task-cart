# Backend API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the four cart APIs (`GET /products`, `GET /cart`, `POST /cart/items`, `DELETE /cart/items/:productId`) through a thin-route → service → repository layering, with integer-cents totals, structured errors, and fake-auth middleware.

**Architecture:** Hono routes parse/validate and delegate to a `cart-service`; the service owns business logic (get-or-create cart, increment, totals, category mapping) and calls `product-repository`/`cart-repository` (Prisma). A single `ApiException` + `onError` renders the contract's structured error shape. An `x-user-id` middleware guards cart routes only.

**Tech Stack:** Hono 4.12, `@hono/zod-validator` 0.8, Zod 4, Prisma 7 + better-sqlite3 adapter, Vitest 4, Node 22.

**Reference spec:** `docs/superpowers/specs/2026-06-14-backend-api-design.md`

> **Environment:** Node 22 (`nvm use`). Commands run from repo root. Tests use the per-run SQLite DB provisioned by `apps/api/src/test/global-setup.ts` (already in place); `process.env.DATABASE_URL` is set before test files import.

---

## File Structure

```
packages/contracts/src/errors.ts          # MODIFY: add UNAUTHORIZED code

apps/api/src/
├── app.ts                                 # MODIFY: real routes, zValidator, onError
├── lib/
│   ├── errors.ts                          # CREATE: ApiException + toErrorResponse
│   └── errors.test.ts                     # CREATE
├── middleware/
│   └── current-user.ts                    # CREATE: x-user-id resolution
├── repositories/
│   ├── category-map.ts                    # exists
│   ├── product-repository.ts              # CREATE
│   └── cart-repository.ts                 # CREATE
├── services/
│   ├── cart-service.ts                    # CREATE
│   └── cart-service.test.ts               # CREATE (DB-backed)
└── app.test.ts                            # MODIFY: per-endpoint integration tests
```

**Type/contract reference (already exists in `@cart/contracts`):**
- `ProductSchema`/`Product`: `{ id, name, priceCents, category }`
- `CartLine`: `{ product: Product, quantity, lineSubtotalCents }`
- `Cart`: `{ lines: CartLine[], grandTotalCents }`
- `AddCartItem`: `{ productId, quantity }` (quantity is `int().positive()`)
- `ApiErrorSchema`: `{ error: { code, message, details? } }`
- `routes`, `USER_HEADER` (`"x-user-id"`)
- DB `Category` (underscore) ↔ wire via `categoryToWire`/`categoryFromWire`

---

## Task 1: Add UNAUTHORIZED to the contract error enum

**Files:**
- Modify: `packages/contracts/src/errors.ts`

- [ ] **Step 1: Add the enum member**

In `packages/contracts/src/errors.ts`, change the `ApiErrorCode` enum to:

```ts
export const ApiErrorCode = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "PRODUCT_NOT_FOUND",
  "CART_ITEM_NOT_FOUND",
  "INTERNAL_ERROR",
]);
```

- [ ] **Step 2: Verify contracts still build and regenerate OpenAPI**

Run: `pnpm --filter @cart/contracts typecheck && pnpm --filter @cart/contracts test && pnpm --filter @cart/contracts generate:openapi`
Expected: typecheck clean, 4 tests PASS, `Wrote .../openapi.json`.

- [ ] **Step 3: Commit**

```bash
git add packages/contracts/src/errors.ts
git commit -m "feat(contracts): add UNAUTHORIZED error code"
```

---

## Task 2: ApiException + error response mapping (TDD)

**Files:**
- Create: `apps/api/src/lib/errors.ts`
- Create: `apps/api/src/lib/errors.test.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/lib/errors.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { ApiException, toErrorResponse } from "./errors.js";
import { ApiErrorSchema } from "@cart/contracts";

describe("ApiException", () => {
  it("carries status, code, message, details", () => {
    const e = new ApiException(404, "PRODUCT_NOT_FOUND", "no such product", { id: "x" });
    expect(e.status).toBe(404);
    expect(e.code).toBe("PRODUCT_NOT_FOUND");
    expect(e.message).toBe("no such product");
    expect(e.details).toEqual({ id: "x" });
  });

  it("maps to a contract-valid error body", () => {
    const e = new ApiException(401, "UNAUTHORIZED", "missing user");
    const body = toErrorResponse(e);
    expect(() => ApiErrorSchema.parse(body)).not.toThrow();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cart/api exec vitest run src/lib/errors.test.ts`
Expected: FAIL — `Cannot find module './errors.js'`.

- [ ] **Step 3: Implement `apps/api/src/lib/errors.ts`**

```ts
import type { ApiError, ApiErrorCode } from "@cart/contracts";

export class ApiException extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiException";
  }
}

export function toErrorResponse(e: ApiException): ApiError {
  return {
    error: { code: e.code, message: e.message, ...(e.details !== undefined ? { details: e.details } : {}) },
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @cart/api exec vitest run src/lib/errors.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/lib/errors.ts apps/api/src/lib/errors.test.ts
git commit -m "feat(api): ApiException and structured error mapping"
```

---

## Task 3: Repositories (product + cart)

**Files:**
- Create: `apps/api/src/repositories/product-repository.ts`
- Create: `apps/api/src/repositories/cart-repository.ts`

> Repositories are thin Prisma wrappers with no HTTP/business logic. They are
> exercised through the service tests in Task 5, so no separate test here.

- [ ] **Step 1: Create `apps/api/src/repositories/product-repository.ts`**

```ts
import { prisma } from "../db.js";

export function listProducts() {
  return prisma.product.findMany({ orderBy: { name: "asc" } });
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}
```

- [ ] **Step 2: Create `apps/api/src/repositories/cart-repository.ts`**

```ts
import { prisma } from "../db.js";

export function getOrCreateCart(userId: string) {
  return prisma.cart.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export function getCartWithLines(userId: string) {
  return prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true }, orderBy: { createdAt: "asc" } } },
  });
}

export function incrementOrCreateItem(cartId: string, productId: string, quantity: number) {
  return prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    update: { quantity: { increment: quantity } },
    create: { cartId, productId, quantity },
  });
}

export async function deleteItem(cartId: string, productId: string): Promise<boolean> {
  const result = await prisma.cartItem.deleteMany({ where: { cartId, productId } });
  return result.count > 0;
}
```

> Note: `cartId_productId` is the compound-unique selector Prisma generates from
> `@@unique([cartId, productId])`. `deleteMany` returns a count so we can signal
> not-found without a throw.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @cart/api typecheck`
Expected: clean. (Confirms the generated client exposes `cartId_productId` and
the relations.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/repositories/product-repository.ts apps/api/src/repositories/cart-repository.ts
git commit -m "feat(api): product and cart repositories"
```

---

## Task 4: Cart service (TDD) — products + read cart

**Files:**
- Create: `apps/api/src/services/cart-service.ts`
- Create: `apps/api/src/services/cart-service.test.ts`

- [ ] **Step 1: Write the failing test `apps/api/src/services/cart-service.test.ts`**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Category } from "../generated/prisma/client.js";
import { ProductListSchema, CartSchema } from "@cart/contracts";
import {
  listProductsWire,
  getCartWire,
  addItemWire,
  removeItemWire,
} from "./cart-service.js";
import { ApiException } from "../lib/errors.js";

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

async function seedUserAndProducts() {
  const user = await prisma.user.create({ data: { name: "U", email: "u@test.local" } });
  const kibble = await prisma.product.create({
    data: { name: "Kibble", priceCents: 1999, category: Category.dry_food },
  });
  const toy = await prisma.product.create({
    data: { name: "Rope", priceCents: 500, category: Category.toys },
  });
  return { userId: user.id, kibble, toy };
}

describe("cart-service: products + read", () => {
  it("lists products with hyphenated wire categories", async () => {
    await seedUserAndProducts();
    const products = await listProductsWire();
    expect(() => ProductListSchema.parse(products)).not.toThrow();
    expect(products.find((p) => p.name === "Kibble")?.category).toBe("dry-food");
  });

  it("returns an empty cart for a user with no items", async () => {
    const { userId } = await seedUserAndProducts();
    const cart = await getCartWire(userId);
    expect(() => CartSchema.parse(cart)).not.toThrow();
    expect(cart).toEqual({ lines: [], grandTotalCents: 0 });
  });
});

describe("cart-service: add + totals", () => {
  it("adds a line and computes subtotal and grand total", async () => {
    const { userId, kibble } = await seedUserAndProducts();
    const cart = await addItemWire(userId, { productId: kibble.id, quantity: 3 });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.lineSubtotalCents).toBe(5997);
    expect(cart.grandTotalCents).toBe(5997);
  });

  it("increments quantity instead of duplicating", async () => {
    const { userId, kibble } = await seedUserAndProducts();
    await addItemWire(userId, { productId: kibble.id, quantity: 2 });
    const cart = await addItemWire(userId, { productId: kibble.id, quantity: 1 });
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.quantity).toBe(3);
  });

  it("sums multiple lines into the grand total", async () => {
    const { userId, kibble, toy } = await seedUserAndProducts();
    await addItemWire(userId, { productId: kibble.id, quantity: 2 }); // 3998
    const cart = await addItemWire(userId, { productId: toy.id, quantity: 1 }); // 500
    expect(cart.grandTotalCents).toBe(4498);
  });

  it("throws PRODUCT_NOT_FOUND for an unknown product", async () => {
    const { userId } = await seedUserAndProducts();
    await expect(addItemWire(userId, { productId: "nope", quantity: 1 }))
      .rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND", status: 404 });
  });
});

describe("cart-service: remove", () => {
  it("removes an existing line", async () => {
    const { userId, kibble } = await seedUserAndProducts();
    await addItemWire(userId, { productId: kibble.id, quantity: 1 });
    const cart = await removeItemWire(userId, kibble.id);
    expect(cart.lines).toHaveLength(0);
  });

  it("throws CART_ITEM_NOT_FOUND for a missing line", async () => {
    const { userId, kibble } = await seedUserAndProducts();
    await expect(removeItemWire(userId, kibble.id))
      .rejects.toMatchObject({ code: "CART_ITEM_NOT_FOUND", status: 404 });
  });

  it("uses ApiException for not-found errors", async () => {
    const { userId } = await seedUserAndProducts();
    const err = await addItemWire(userId, { productId: "nope", quantity: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiException);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @cart/api exec vitest run src/services/cart-service.test.ts`
Expected: FAIL — `Cannot find module './cart-service.js'`.

- [ ] **Step 3: Implement `apps/api/src/services/cart-service.ts`**

```ts
import type { Cart, Product, ProductList, AddCartItem } from "@cart/contracts";
import { CartSchema } from "@cart/contracts";
import { categoryToWire } from "../repositories/category-map.js";
import {
  listProducts,
  findProductById,
} from "../repositories/product-repository.js";
import {
  getOrCreateCart,
  getCartWithLines,
  incrementOrCreateItem,
  deleteItem,
} from "../repositories/cart-repository.js";
import { ApiException } from "../lib/errors.js";
import type { Product as DbProduct } from "../generated/prisma/client.js";

function toWireProduct(p: DbProduct): Product {
  return {
    id: p.id,
    name: p.name,
    priceCents: p.priceCents,
    category: categoryToWire(p.category),
  };
}

export async function listProductsWire(): Promise<ProductList> {
  const rows = await listProducts();
  return rows.map(toWireProduct);
}

export async function getCartWire(userId: string): Promise<Cart> {
  const cart = await getCartWithLines(userId);
  const lines = (cart?.items ?? []).map((item) => ({
    product: toWireProduct(item.product),
    quantity: item.quantity,
    lineSubtotalCents: item.product.priceCents * item.quantity,
  }));
  const grandTotalCents = lines.reduce((sum, l) => sum + l.lineSubtotalCents, 0);
  return CartSchema.parse({ lines, grandTotalCents });
}

export async function addItemWire(userId: string, input: AddCartItem): Promise<Cart> {
  const product = await findProductById(input.productId);
  if (!product) {
    throw new ApiException(404, "PRODUCT_NOT_FOUND", `Unknown product: ${input.productId}`);
  }
  const cart = await getOrCreateCart(userId);
  await incrementOrCreateItem(cart.id, input.productId, input.quantity);
  return getCartWire(userId);
}

export async function removeItemWire(userId: string, productId: string): Promise<Cart> {
  const cart = await getOrCreateCart(userId);
  const removed = await deleteItem(cart.id, productId);
  if (!removed) {
    throw new ApiException(404, "CART_ITEM_NOT_FOUND", `No cart line for product: ${productId}`);
  }
  return getCartWire(userId);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @cart/api exec vitest run src/services/cart-service.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @cart/api typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/cart-service.ts apps/api/src/services/cart-service.test.ts
git commit -m "feat(api): cart service — products, totals, add/increment, remove"
```

---

## Task 5: current-user middleware

**Files:**
- Create: `apps/api/src/middleware/current-user.ts`

- [ ] **Step 1: Create `apps/api/src/middleware/current-user.ts`**

```ts
import type { MiddlewareHandler } from "hono";
import { USER_HEADER } from "@cart/contracts";
import { prisma } from "../db.js";
import { ApiException } from "../lib/errors.js";

export type CurrentUserEnv = { Variables: { userId: string } };

export const currentUser: MiddlewareHandler<CurrentUserEnv> = async (c, next) => {
  const headerId = c.req.header(USER_HEADER);
  if (!headerId) {
    throw new ApiException(401, "UNAUTHORIZED", `Missing ${USER_HEADER} header`);
  }
  const user = await prisma.user.findUnique({ where: { id: headerId } });
  if (!user) {
    throw new ApiException(401, "UNAUTHORIZED", "Unknown user");
  }
  c.set("userId", user.id);
  await next();
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @cart/api typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/middleware/current-user.ts
git commit -m "feat(api): x-user-id current-user middleware"
```

---

## Task 6: Wire the routes in app.ts

**Files:**
- Modify: `apps/api/src/app.ts`

- [ ] **Step 1: Replace `apps/api/src/app.ts` entirely**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { routes, AddCartItemSchema, type ApiError } from "@cart/contracts";
import { ApiException, toErrorResponse } from "./lib/errors.js";
import { currentUser, type CurrentUserEnv } from "./middleware/current-user.js";
import {
  listProductsWire,
  getCartWire,
  addItemWire,
  removeItemWire,
} from "./services/cart-service.js";

export const app = new Hono<CurrentUserEnv>();

app.get(routes.products, async (c) => {
  return c.json(await listProductsWire());
});

app.get(routes.cart, currentUser, async (c) => {
  return c.json(await getCartWire(c.get("userId")));
});

app.post(
  routes.cartItems,
  currentUser,
  zValidator("json", AddCartItemSchema, (result) => {
    if (!result.success) {
      throw new ApiException(422, "VALIDATION_ERROR", "Invalid request body", result.error.issues);
    }
  }),
  async (c) => {
    const body = c.req.valid("json");
    return c.json(await addItemWire(c.get("userId"), body));
  },
);

app.delete(`${routes.cartItems}/:productId`, currentUser, async (c) => {
  const productId = c.req.param("productId");
  return c.json(await removeItemWire(c.get("userId"), productId));
});

app.onError((err, c) => {
  if (err instanceof ApiException) {
    return c.json(toErrorResponse(err), err.status as never);
  }
  const body: ApiError = {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
  return c.json(body, 500);
});
```

> `err.status as never` satisfies Hono's `ContentfulStatusCode` typing for a
> dynamic numeric status; the value is a real HTTP status from `ApiException`.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @cart/api typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.ts
git commit -m "feat(api): wire cart routes through service and middleware"
```

---

## Task 7: Endpoint integration tests

**Files:**
- Modify: `apps/api/src/app.test.ts`

- [ ] **Step 1: Replace `apps/api/src/app.test.ts` entirely**

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient, Category } from "./generated/prisma/client.js";
import { app } from "./app.js";
import {
  routes,
  USER_HEADER,
  ProductListSchema,
  CartSchema,
  ApiErrorSchema,
} from "@cart/contracts";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const USER_ID = "user-1";

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { id: USER_ID, name: "Demo", email: "d@test.local" } });
});

async function makeProduct(name = "Kibble", priceCents = 1999) {
  return prisma.product.create({
    data: { name, priceCents, category: Category.dry_food },
  });
}

const auth = { [USER_HEADER]: USER_ID, "content-type": "application/json" };

describe("GET /api/products", () => {
  it("returns the product list (no auth needed)", async () => {
    await makeProduct();
    const res = await app.request(routes.products);
    expect(res.status).toBe(200);
    const body = ProductListSchema.parse(await res.json());
    expect(body[0]!.category).toBe("dry-food");
  });
});

describe("GET /api/cart", () => {
  it("returns an empty cart for an authed user", async () => {
    const res = await app.request(routes.cart, { headers: auth });
    expect(res.status).toBe(200);
    const cart = CartSchema.parse(await res.json());
    expect(cart).toEqual({ lines: [], grandTotalCents: 0 });
  });

  it("401s without the user header", async () => {
    const res = await app.request(routes.cart);
    expect(res.status).toBe(401);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("POST /api/cart/items", () => {
  it("adds a product and returns the updated cart", async () => {
    const product = await makeProduct();
    const res = await app.request(routes.cartItems, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ productId: product.id, quantity: 2 }),
    });
    expect(res.status).toBe(200);
    const cart = CartSchema.parse(await res.json());
    expect(cart.lines[0]!.lineSubtotalCents).toBe(3998);
  });

  it("404s for an unknown product", async () => {
    const res = await app.request(routes.cartItems, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ productId: "nope", quantity: 1 }),
    });
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("PRODUCT_NOT_FOUND");
  });

  it("422s for a non-positive quantity", async () => {
    const product = await makeProduct();
    const res = await app.request(routes.cartItems, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ productId: product.id, quantity: 0 }),
    });
    expect(res.status).toBe(422);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("DELETE /api/cart/items/:productId", () => {
  it("removes a line and returns the updated cart", async () => {
    const product = await makeProduct();
    await app.request(routes.cartItems, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ productId: product.id, quantity: 1 }),
    });
    const res = await app.request(routes.cartItem(product.id), {
      method: "DELETE",
      headers: auth,
    });
    expect(res.status).toBe(200);
    const cart = CartSchema.parse(await res.json());
    expect(cart.lines).toHaveLength(0);
  });

  it("404s for a line not in the cart", async () => {
    const product = await makeProduct();
    const res = await app.request(routes.cartItem(product.id), {
      method: "DELETE",
      headers: auth,
    });
    expect(res.status).toBe(404);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("CART_ITEM_NOT_FOUND");
  });
});
```

- [ ] **Step 2: Run the API test set**

Run: `pnpm --filter @cart/api test`
Expected: PASS — `errors.test.ts` (2), `category-map.test.ts` (2),
`cart-service.test.ts` (9), `db.test.ts` (2), `app.test.ts` (8). 23 total.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/app.test.ts
git commit -m "test(api): per-endpoint integration tests for the cart APIs"
```

---

## Task 8: Manual smoke test + full pipeline + docs

**Files:**
- Modify: `AGENTS.md` (status line)

- [ ] **Step 1: Seed and boot the API**

Run:
```bash
pnpm --filter @cart/api db:seed
pnpm --filter @cart/api dev
```
(Leave running in one terminal; run the curls below in another. Stop it after.)

- [ ] **Step 2: Smoke-test each endpoint with curl**

```bash
# products (public)
curl -s localhost:8787/api/products | head -c 200; echo
# cart without header -> 401
curl -s -o /dev/null -w "%{http_code}\n" localhost:8787/api/cart
# cart with header -> 200 empty
curl -s -H "x-user-id: user-1" localhost:8787/api/cart; echo
# add an item (use a real product id from the products response)
PID=$(curl -s localhost:8787/api/products | node -e "process.stdin.once('data',d=>console.log(JSON.parse(d)[0].id))")
curl -s -H "x-user-id: user-1" -H "content-type: application/json" -d "{\"productId\":\"$PID\",\"quantity\":2}" localhost:8787/api/cart/items; echo
# delete it
curl -s -X DELETE -H "x-user-id: user-1" localhost:8787/api/cart/items/$PID; echo
```
Expected: products JSON; `401`; `{"lines":[],"grandTotalCents":0}`; a cart with
one line and a non-zero `grandTotalCents`; then a cart with `lines: []` again.

- [ ] **Step 3: Run the whole pipeline**

Run: `pnpm turbo lint typecheck test`
Expected: all workspaces PASS.

- [ ] **Step 4: Regenerate OpenAPI and confirm UNAUTHORIZED present**

Run: `pnpm --filter @cart/contracts generate:openapi && grep -c UNAUTHORIZED packages/contracts/openapi.json`
Expected: a count ≥ 1.

- [ ] **Step 5: Update the `## Status` section of `AGENTS.md`**

```markdown
## Status
Backend cart APIs implemented: `GET /products`, `GET /cart`,
`POST /cart/items` (increment-on-duplicate), `DELETE /cart/items/:productId`,
through a thin-route → cart-service → repository layering with integer-cents
totals, structured errors (`ApiException` + `onError`), and an `x-user-id`
middleware on cart routes. Unit + integration tested. The frontend (product list
+ cart view) is the next phase. See `docs/superpowers/plans/`.
```

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md
git commit -m "docs: mark backend cart APIs complete in AGENTS.md"
```

---

## Notes for the implementer

- **Node 22 only.** `nvm use` first.
- **Routes delegate, services decide.** Handlers never touch Prisma directly; all
  cart logic lives in `cart-service`. Repositories are pure Prisma wrappers.
- **Money stays integer cents** the whole way; totals are computed in
  `getCartWire`, never stored. `getCartWire` validates against `CartSchema`
  before returning — a defensive boundary that also catches mapping bugs.
- **The 422 path** comes from the `zValidator` hook throwing `ApiException`, which
  `onError` renders — non-positive quantity is already rejected by
  `AddCartItemSchema` (`int().positive()`), so no manual quantity check is needed.
- **`getOrCreateCart` in `removeItemWire`** means deleting from an absent/empty
  cart yields `404 CART_ITEM_NOT_FOUND` (the create makes an empty cart, the
  delete finds nothing) — intended, not a silent success.
- **Test DB:** `process.env.DATABASE_URL!` is set by `global-setup.ts`. The
  `app.test.ts` seeds its own `user-1` in `beforeEach` (the middleware looks the
  user up in the DB, so the row must exist).
- **Do not change the frontend** in this phase.
```
