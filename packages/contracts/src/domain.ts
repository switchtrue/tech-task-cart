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
