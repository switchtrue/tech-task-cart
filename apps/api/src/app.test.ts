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
