import type { Cart, Product, ProductList, AddCartItem } from "@cart/contracts";
import { CartSchema } from "@cart/contracts";
import { categoryToWire } from "../repositories/category-map.js";
import { listProducts, findProductById } from "../repositories/product-repository.js";
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
