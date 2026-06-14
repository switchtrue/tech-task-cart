import { OpenAPIRegistry, OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject } from "openapi3-ts/oas30";
import { ProductSchema, CartSchema, AddCartItemSchema } from "./domain.js";
import { ApiErrorSchema } from "./errors.js";

export function buildOpenApiDocument(): OpenAPIObject {
  const registry = new OpenAPIRegistry();
  registry.register("Product", ProductSchema);
  registry.register("Cart", CartSchema);
  registry.register("AddCartItem", AddCartItemSchema);
  registry.register("ApiError", ApiErrorSchema);

  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: "3.0.0",
    info: { title: "Cart API", version: "0.0.0" },
  });
}
