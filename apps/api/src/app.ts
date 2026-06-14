import { Hono } from "hono";
import { routes, type ApiError } from "@cart/contracts";

function notImplemented(): ApiError {
  return {
    error: { code: "INTERNAL_ERROR", message: "Not implemented" },
  };
}

export const app = new Hono()
  .get(routes.products, (c) => c.json(notImplemented(), 501))
  .get(routes.cart, (c) => c.json(notImplemented(), 501))
  .post(routes.cartItems, (c) => c.json(notImplemented(), 501))
  // Hono needs a `:param` pattern; routes.cartItem(id) builds concrete client paths.
  .delete(`${routes.cartItems}/:productId`, (c) => c.json(notImplemented(), 501));

app.onError((err, c) => {
  const body: ApiError = {
    error: { code: "INTERNAL_ERROR", message: err.message },
  };
  return c.json(body, 500);
});
