import { describe, it, expect } from "vitest";
import { app } from "./app.js";
import { routes, ApiErrorSchema } from "@cart/contracts";

describe("api app", () => {
  it("returns a structured 501 for products (stub)", async () => {
    const res = await app.request(routes.products);
    expect(res.status).toBe(501);
    const body = ApiErrorSchema.parse(await res.json());
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
