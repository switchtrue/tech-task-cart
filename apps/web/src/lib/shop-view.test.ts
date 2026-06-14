import { describe, expect, it } from "vitest";
import type { Cart, Product } from "@cart/contracts";
import {
  formatMoney,
  getCartItemCount,
  groupProductsByCategory,
  sortProductsByName,
} from "./shop-view";

const products: Product[] = [
  { id: "salmon", name: "Salmon Adult Dry Dog Food 3kg", priceCents: 4999, category: "dry-food" },
  { id: "beef", name: "Beef Casserole Wet Dog Food 400g x12", priceCents: 2899, category: "wet-food" },
  { id: "rope", name: "Tug Rope Dog Toy", priceCents: 1299, category: "toys" },
];

describe("shop view helpers", () => {
  it("formats integer cents as AUD", () => {
    expect(formatMoney(4999)).toBe("$49.99");
  });

  it("sorts products alphabetically by name", () => {
    expect(sortProductsByName(products).map((product) => product.id)).toEqual([
      "beef",
      "salmon",
      "rope",
    ]);
  });

  it("groups products in category display order", () => {
    expect(groupProductsByCategory(products).map((group) => group.label)).toEqual([
      "Dry Food",
      "Wet Food",
      "Toys",
    ]);
  });

  it("counts quantities across cart lines", () => {
    const cart: Cart = {
      lines: [
        { product: products[0]!, quantity: 2, lineSubtotalCents: 9998 },
        { product: products[1]!, quantity: 1, lineSubtotalCents: 2899 },
      ],
      grandTotalCents: 12897,
    };
    expect(getCartItemCount(cart)).toBe(3);
  });
});
