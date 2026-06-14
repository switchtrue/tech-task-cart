export const routes = {
  products: "/api/products",
  cart: "/api/cart",
  cartItems: "/api/cart/items",
  cartItem: (productId: string) => `/api/cart/items/${productId}`,
} as const;

export const USER_HEADER = "x-user-id";
