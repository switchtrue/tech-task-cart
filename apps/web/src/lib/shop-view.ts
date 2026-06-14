import type { Cart, Category, Product } from "@cart/contracts";

export const CATEGORY_ORDER: readonly Category[] = [
  "dry-food",
  "wet-food",
  "treats",
  "toys",
  "healthcare",
];

export const CATEGORY_LABELS: Record<Category, string> = {
  "dry-food": "Dry Food",
  "wet-food": "Wet Food",
  treats: "Treats",
  toys: "Toys",
  healthcare: "Healthcare",
};

export function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);
}

export function sortProductsByName(products: readonly Product[]) {
  return [...products].sort((a, b) => a.name.localeCompare(b.name));
}

export function groupProductsByCategory(products: readonly Product[]) {
  const sorted = sortProductsByName(products);
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    products: sorted.filter((product) => product.category === category),
  })).filter((group) => group.products.length > 0);
}

export function getCartItemCount(cart: Cart) {
  return cart.lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function pluralizeItems(count: number) {
  return count === 1 ? "1 item" : `${count} items`;
}
