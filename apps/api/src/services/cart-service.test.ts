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
    await addItemWire(userId, { productId: kibble.id, quantity: 2 });
    const cart = await addItemWire(userId, { productId: toy.id, quantity: 1 });
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
