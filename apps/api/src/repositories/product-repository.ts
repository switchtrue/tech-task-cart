import { prisma } from "../db.js";

export function listProducts() {
  return prisma.product.findMany({ orderBy: { name: "asc" } });
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}
