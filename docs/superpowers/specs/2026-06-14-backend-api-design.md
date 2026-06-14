# Backend API — Design

**Date:** 2026-06-14
**Status:** Approved — the four cart APIs (route handlers + service/repository layer)
**Builds on:** the scaffold and data-model specs in `docs/superpowers/specs/`

## Context

The scaffold left the four routes returning `501` stubs; the data-model phase
delivered the Prisma schema, migration, seed, and category boundary map. This
phase implements the real handlers: list products, read the cart with totals,
add/increment a line, and remove a line — wired through a service and repository
layer, validated at the edge with `@hono/zod-validator`, with structured errors.

The wire contract in `@cart/contracts` is the source of truth and is unchanged
**except** for one addition (an `UNAUTHORIZED` error code, see below).

## Goals

- Implement `GET /api/products`, `GET /api/cart`, `POST /api/cart/items`,
  `DELETE /api/cart/items/:productId` to spec.
- Thin routes → cart service (business logic) → repositories (Prisma).
- Integer-cents totals computed at read time.
- Structured errors via a single `ApiException` + `onError` handler.
- Fake-auth via an `x-user-id` middleware on cart routes.
- Unit (service) and integration (endpoint) tests; pipeline stays green.

## Non-goals (this phase)

- Frontend work.
- Auth beyond the `x-user-id` header seam.
- Pagination, filtering, sorting of products.
- Stored/denormalised totals.

## Decisions

| Topic | Decision |
| --- | --- |
| Layering | Thin routes → `cart-service` → `product-repository` / `cart-repository`. |
| Totals | Computed at read time in the service (integer cents). No stored totals. |
| Add semantics | Upsert: increment existing line by `quantity`, else create. Always returns the full updated cart, `200`. |
| Delete semantics | Missing line → `404 CART_ITEM_NOT_FOUND`; success → `200` with updated cart. |
| Empty cart | `GET /cart` for a user with no items → `200 { lines: [], grandTotalCents: 0 }`. |
| User resolution | Middleware on cart routes only; `x-user-id` **strictly required**. |
| Products auth | `GET /products` is public (no header). |
| Missing/unknown user | `401 UNAUTHORIZED`. |
| Unknown product | `404 PRODUCT_NOT_FOUND`. |
| Non-positive quantity | `422 VALIDATION_ERROR` (enforced by `AddCartItemSchema`). |
| Contract change | Add `UNAUTHORIZED` to `ApiErrorCode`. |

## Contract change

`packages/contracts/src/errors.ts` — add one enum member:

```ts
export const ApiErrorCode = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "PRODUCT_NOT_FOUND",
  "CART_ITEM_NOT_FOUND",
  "INTERNAL_ERROR",
]);
```

This is the only `@cart/contracts` change. Regenerate the OpenAPI document
afterward. No request/response *shapes* change.

## File structure

```
packages/contracts/src/errors.ts        # MODIFY: add UNAUTHORIZED code

apps/api/src/
├── app.ts                               # MODIFY: real routes + zValidator + onError
├── lib/
│   ├── errors.ts                        # CREATE: ApiException + toErrorResponse
│   └── errors.test.ts                   # CREATE: mapping unit test
├── middleware/
│   └── current-user.ts                  # CREATE: x-user-id resolution (cart routes)
├── repositories/
│   ├── category-map.ts                  # exists
│   ├── product-repository.ts            # CREATE: list, findById
│   └── cart-repository.ts               # CREATE: get-or-create, lines, upsert, delete
├── services/
│   ├── cart-service.ts                  # CREATE: orchestration + totals + wire mapping
│   └── cart-service.test.ts             # CREATE: DB-backed unit tests
└── app.test.ts                          # MODIFY: per-endpoint integration tests
```

## Components

### `lib/errors.ts`
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
  }
}

export function toErrorResponse(e: ApiException): ApiError {
  return { error: { code: e.code, message: e.message, details: e.details } };
}
```

The `onError` handler in `app.ts`: if `err instanceof ApiException`, respond
`toErrorResponse(err)` with `err.status`; otherwise `500 INTERNAL_ERROR`.

### `middleware/current-user.ts`
Reads `x-user-id`. Absent → throw `ApiException(401, "UNAUTHORIZED", ...)`.
Present but no matching `User` row → same 401. On success, sets the resolved
user id on context (`c.set("userId", id)`). Applied only to the three cart
routes (not `/products`).

### `repositories/product-repository.ts`
- `listProducts()` → all products (DB rows).
- `findProductById(id)` → product row or `null`.

### `repositories/cart-repository.ts`
- `getOrCreateCart(userId)` → the user's cart row (create if absent).
- `getCartWithLines(userId)` → cart + items + each item's product (or empty).
- `incrementOrCreateItem(cartId, productId, qty)` → upsert on
  `@@unique([cartId, productId])`: `quantity: { increment: qty }` on conflict.
- `deleteItem(cartId, productId)` → delete; signal not-found if no row removed.

### `services/cart-service.ts`
- `listProductsWire()` → products mapped via `categoryToWire`.
- `getCartWire(userId)` → build the wire `Cart`: for each line
  `lineSubtotalCents = product.priceCents * quantity`;
  `grandTotalCents = sum`. Validate against `CartSchema` before returning.
- `addItemWire(userId, { productId, quantity })` → assert product exists (else
  `404 PRODUCT_NOT_FOUND`), get-or-create cart, increment/create, return
  `getCartWire`.
- `removeItemWire(userId, productId)` → get-or-create cart, delete (else
  `404 CART_ITEM_NOT_FOUND`), return `getCartWire`. A user with no cart (or an
  empty one) deleting any product therefore yields `404 CART_ITEM_NOT_FOUND`,
  not a silent success.

## Data flow (POST /cart/items)

```
client → POST /api/cart/items  {productId, quantity}
  → current-user middleware (resolve userId or 401)
  → zValidator("json", AddCartItemSchema)  (422 on non-positive/malformed)
  → cart-service.addItemWire(userId, body)
      → product-repository.findProductById → null ⇒ 404 PRODUCT_NOT_FOUND
      → cart-repository.getOrCreateCart
      → cart-repository.incrementOrCreateItem (upsert, quantity += n)
      → cart-service.getCartWire (compute totals, map categories)
  → 200 application/json  Cart
```

## Error matrix

| Condition | Status | Code |
| --- | --- | --- |
| Missing/unknown `x-user-id` (cart routes) | 401 | `UNAUTHORIZED` |
| Malformed body / non-positive quantity | 422 | `VALIDATION_ERROR` |
| `productId` not a real product | 404 | `PRODUCT_NOT_FOUND` |
| `DELETE` a line not in the cart | 404 | `CART_ITEM_NOT_FOUND` |
| Unexpected error | 500 | `INTERNAL_ERROR` |

All bodies conform to `ApiErrorSchema`.

## Testing

### Service unit tests (`cart-service.test.ts`, DB-backed)
- get-or-create cart is idempotent (two calls → one cart).
- add then add same product → single line, summed quantity (not a duplicate row).
- totals: product `priceCents 1999`, qty 3 → `lineSubtotalCents 5997`; two lines
  sum into `grandTotalCents`.
- add unknown product → throws `ApiException` with code `PRODUCT_NOT_FOUND`.
- remove existing line → gone; remove missing line → throws `CART_ITEM_NOT_FOUND`.
- empty cart → `{ lines: [], grandTotalCents: 0 }`.

### Integration tests (`app.test.ts`, via `app.request()`)
- `GET /products` (no header) → 200, body parses `ProductListSchema`, categories
  hyphenated.
- `GET /cart` with header → 200, body parses `CartSchema`.
- `GET /cart` without header → 401, body parses `ApiErrorSchema`, code
  `UNAUTHORIZED`.
- `POST /cart/items` valid → 200 Cart; the added line present with correct
  subtotal.
- `POST` unknown product → 404 `PRODUCT_NOT_FOUND`.
- `POST` quantity `0` / `-1` → 422 `VALIDATION_ERROR`.
- `DELETE` existing line → 200 Cart without that line.
- `DELETE` missing line → 404 `CART_ITEM_NOT_FOUND`.

Tests create their own fixtures (user, products) against the per-run SQLite test
DB from `src/test/global-setup.ts`; they clean tables in `beforeEach` as in the
existing `db.test.ts`.

## Acceptance criteria

- All four endpoints behave per the error matrix and the decisions table.
- `pnpm --filter @cart/contracts generate:openapi` emits a doc including
  `UNAUTHORIZED`.
- `pnpm turbo lint typecheck test` green across all workspaces.
- No stored totals; money is integer cents end-to-end.
- The web app's existing `api-client.ts` works against these endpoints unchanged
  (it already sends `x-user-id: user-1` and expects `Cart`/`ProductList`).
- No frontend changes in this phase.
