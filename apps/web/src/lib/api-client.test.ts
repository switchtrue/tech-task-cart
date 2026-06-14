import { describe, it, expect } from "vitest";
import { routes, USER_HEADER } from "@cart/contracts";

describe("api-client wiring", () => {
  it("references the shared route map", () => {
    expect(routes.products).toBe("/api/products");
    expect(USER_HEADER).toBe("x-user-id");
  });
});
