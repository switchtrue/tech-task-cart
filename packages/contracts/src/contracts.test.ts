import { describe, it, expect } from "vitest";
import { ProductSchema, routes } from "./index.js";
import { buildOpenApiDocument } from "./openapi";

describe("contracts", () => {
  it("validates a product", () => {
    const parsed = ProductSchema.parse({
      id: "p1",
      name: "Kibble",
      priceCents: 1999,
      category: "dry-food",
    });
    expect(parsed.priceCents).toBe(1999);
  });

  it("rejects negative price", () => {
    expect(() =>
      ProductSchema.parse({ id: "p1", name: "x", priceCents: -1, category: "toys" }),
    ).toThrow();
  });

  it("exposes a stable route map", () => {
    expect(routes.cartItem("p1")).toBe("/api/cart/items/p1");
  });

  it("builds an openapi document", () => {
    const doc = buildOpenApiDocument();
    expect(doc.openapi).toBe("3.0.0");
    expect(doc.components?.schemas?.Product).toBeDefined();
  });
});
