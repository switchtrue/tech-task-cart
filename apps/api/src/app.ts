import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { routes, AddCartItemSchema, type ApiError } from "@cart/contracts";
import { ApiException, toErrorResponse } from "./lib/errors.js";
import { currentUser, type CurrentUserEnv } from "./middleware/current-user.js";
import {
  listProductsWire,
  getCartWire,
  addItemWire,
  removeItemWire,
} from "./services/cart-service.js";

export const app = new Hono<CurrentUserEnv>();

app.get(routes.products, async (c) => {
  return c.json(await listProductsWire());
});

app.get(routes.cart, currentUser, async (c) => {
  return c.json(await getCartWire(c.get("userId")));
});

app.post(
  routes.cartItems,
  currentUser,
  zValidator("json", AddCartItemSchema, (result) => {
    if (!result.success) {
      throw new ApiException(422, "VALIDATION_ERROR", "Invalid request body", result.error.issues);
    }
  }),
  async (c) => {
    const body = c.req.valid("json");
    return c.json(await addItemWire(c.get("userId"), body));
  },
);

app.delete(`${routes.cartItems}/:productId`, currentUser, async (c) => {
  const productId = c.req.param("productId");
  return c.json(await removeItemWire(c.get("userId"), productId));
});

app.onError((err, c) => {
  if (err instanceof ApiException) {
    return c.json(toErrorResponse(err), err.status as never);
  }
  const body: ApiError = {
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  };
  return c.json(body, 500);
});
