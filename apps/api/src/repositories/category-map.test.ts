import { describe, it, expect } from "vitest";
import { Category as WireCategoryEnum } from "@cart/contracts";
import { categoryToWire, categoryFromWire } from "./category-map.js";

describe("category-map", () => {
  it("round-trips every contract category value", () => {
    for (const wire of WireCategoryEnum.options) {
      expect(categoryToWire(categoryFromWire(wire))).toBe(wire);
    }
  });

  it("maps underscores to hyphens for compound names", () => {
    expect(categoryToWire(categoryFromWire("dry-food"))).toBe("dry-food");
    expect(categoryFromWire("wet-food")).toBe("wet_food");
  });
});
