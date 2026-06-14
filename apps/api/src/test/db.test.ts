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
