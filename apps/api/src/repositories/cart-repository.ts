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
