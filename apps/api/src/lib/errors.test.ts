import { describe, it, expect } from "vitest";
import { ApiException, toErrorResponse } from "./errors.js";
import { ApiErrorSchema } from "@cart/contracts";

describe("ApiException", () => {
  it("carries status, code, message, details", () => {
    const e = new ApiException(404, "PRODUCT_NOT_FOUND", "no such product", { id: "x" });
    expect(e.status).toBe(404);
    expect(e.code).toBe("PRODUCT_NOT_FOUND");
    expect(e.message).toBe("no such product");
    expect(e.details).toEqual({ id: "x" });
  });

  it("maps to a contract-valid error body", () => {
    const e = new ApiException(401, "UNAUTHORIZED", "missing user");
    const body = toErrorResponse(e);
    expect(() => ApiErrorSchema.parse(body)).not.toThrow();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });
});
