import {
  ProductListSchema,
  CartSchema,
  routes,
  USER_HEADER,
  type ProductList,
  type Cart,
  type AddCartItem,
} from "@cart/contracts";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";
const DEV_USER_ID = "user-1";

async function request<T>(
  path: string,
  schema: { parse: (v: unknown) => T },
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      [USER_HEADER]: DEV_USER_ID,
      ...init?.headers,
    },
  });
  const json: unknown = await res.json();
  if (!res.ok) throw new Error(`API ${res.status}`);
  return schema.parse(json);
}

export const apiClient = {
  listProducts: (): Promise<ProductList> => request(routes.products, ProductListSchema),
  getCart: (): Promise<Cart> => request(routes.cart, CartSchema),
  addItem: (body: AddCartItem): Promise<Cart> =>
    request(routes.cartItems, CartSchema, { method: "POST", body: JSON.stringify(body) }),
  removeItem: (productId: string): Promise<Cart> =>
    request(routes.cartItem(productId), CartSchema, { method: "DELETE" }),
};
