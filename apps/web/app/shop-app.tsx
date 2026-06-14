"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cart, Category, Product } from "@cart/contracts";
import { ApiClientError, apiClient } from "@/lib/api-client";
import {
  CATEGORY_LABELS,
  formatMoney,
  getCartItemCount,
  groupProductsByCategory,
  pluralizeItems,
  sortProductsByName,
} from "@/lib/shop-view";

type ViewMode = "products" | "categories";

const emptyCart: Cart = { lines: [], grandTotalCents: 0 };

function readableError(error: unknown) {
  if (error instanceof ApiClientError) {
    return `${error.message} (${error.code})`;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function ShopApp() {
  const [view, setView] = useState<ViewMode>("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [isLoading, setIsLoading] = useState(true);
  const [cartOpen, setCartOpen] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [removingProductId, setRemovingProductId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadStore = useCallback(async () => {
    setIsLoading(true);
    setNotice(null);
    try {
      const [nextProducts, nextCart] = await Promise.all([
        apiClient.listProducts(),
        apiClient.getCart(),
      ]);
      setProducts(nextProducts);
      setCart(nextCart);
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStore();
  }, [loadStore]);

  const sortedProducts = useMemo(() => sortProductsByName(products), [products]);
  const categoryGroups = useMemo(() => groupProductsByCategory(products), [products]);

  const addProduct = async (product: Product) => {
    setPendingProductId(product.id);
    setNotice(null);
    try {
      const nextCart = await apiClient.addItem({ productId: product.id, quantity: 1 });
      setCart(nextCart);
      setCartOpen(true);
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setPendingProductId(null);
    }
  };

  const removeLine = async (productId: string) => {
    setRemovingProductId(productId);
    setNotice(null);
    try {
      setCart(await apiClient.removeItem(productId));
    } catch (error) {
      setNotice(readableError(error));
    } finally {
      setRemovingProductId(null);
    }
  };

  return (
    <div className="shop-shell">
      <Header activeView={view} onChange={setView} />

      <main className="shop-main" aria-busy={isLoading}>
        <div className="shop-content">
          {notice ? (
            <div className="notice-panel" role="alert">
              <span>{notice}</span>
              <button type="button" onClick={() => void loadStore()}>
                Retry
              </button>
            </div>
          ) : null}

          {view === "products" ? (
            <ProductsView
              products={sortedProducts}
              isLoading={isLoading}
              pendingProductId={pendingProductId}
              onAddProduct={addProduct}
            />
          ) : (
            <CategoriesView
              groups={categoryGroups}
              isLoading={isLoading}
              pendingProductId={pendingProductId}
              onAddProduct={addProduct}
            />
          )}
        </div>
      </main>

      <CartPanel
        cart={cart}
        isOpen={cartOpen}
        removingProductId={removingProductId}
        onClose={() => setCartOpen(false)}
        onRemoveLine={removeLine}
      />

      <FloatingFooter
        cart={cart}
        isOpen={cartOpen}
        onToggleCart={() => setCartOpen((open) => !open)}
      />
    </div>
  );
}

function Header({
  activeView,
  onChange,
}: {
  activeView: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <header className="floating-header" aria-label="Primary navigation">
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <PawMark />
        </span>
        <span>Pet Circle Cart</span>
      </div>
      <nav className="nav-switch" aria-label="Store views">
        <button
          type="button"
          className={activeView === "products" ? "nav-button active" : "nav-button"}
          onClick={() => onChange("products")}
        >
          Products
        </button>
        <button
          type="button"
          className={activeView === "categories" ? "nav-button active" : "nav-button"}
          onClick={() => onChange("categories")}
        >
          Categories
        </button>
      </nav>
    </header>
  );
}

function ProductsView({
  products,
  isLoading,
  pendingProductId,
  onAddProduct,
}: {
  products: Product[];
  isLoading: boolean;
  pendingProductId: string | null;
  onAddProduct: (product: Product) => void;
}) {
  return (
    <section className="view-section" aria-labelledby="products-title">
      <h1 id="products-title">Products</h1>
      <div className="product-grid">
        {isLoading
          ? Array.from({ length: 8 }).map((_, index) => <ProductSkeleton key={index} />)
          : products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isPending={pendingProductId === product.id}
                onAddProduct={onAddProduct}
              />
            ))}
      </div>
    </section>
  );
}

function CategoriesView({
  groups,
  isLoading,
  pendingProductId,
  onAddProduct,
}: {
  groups: ReturnType<typeof groupProductsByCategory>;
  isLoading: boolean;
  pendingProductId: string | null;
  onAddProduct: (product: Product) => void;
}) {
  return (
    <section className="view-section" aria-labelledby="categories-title">
      <h1 id="categories-title">Categories</h1>
      <div className="category-stack">
        {isLoading
          ? Array.from({ length: 5 }).map((_, index) => <CategorySkeleton key={index} />)
          : groups.map((group) => (
              <section className="category-band" key={group.category} aria-labelledby={`${group.category}-title`}>
                <div className="category-lead">
                  <span className="category-icon" aria-hidden="true">
                    <CategoryIcon category={group.category} />
                  </span>
                  <h2 id={`${group.category}-title`}>{group.label}</h2>
                </div>
                <div className="category-products">
                  {group.products.map((product) => (
                    <CategoryProduct
                      key={product.id}
                      product={product}
                      isPending={pendingProductId === product.id}
                      onAddProduct={onAddProduct}
                    />
                  ))}
                </div>
              </section>
            ))}
      </div>
    </section>
  );
}

function ProductCard({
  product,
  isPending,
  onAddProduct,
}: {
  product: Product;
  isPending: boolean;
  onAddProduct: (product: Product) => void;
}) {
  return (
    <article className="product-card">
      <ProductArtwork product={product} />
      <div className="product-copy">
        <h2>{product.name}</h2>
        <p>{CATEGORY_LABELS[product.category]}</p>
      </div>
      <strong className="product-price">{formatMoney(product.priceCents)}</strong>
      <button
        type="button"
        className="add-button add-button-outline"
        disabled={isPending}
        onClick={() => onAddProduct(product)}
      >
        {isPending ? "Adding" : "Add"}
      </button>
    </article>
  );
}

function CategoryProduct({
  product,
  isPending,
  onAddProduct,
}: {
  product: Product;
  isPending: boolean;
  onAddProduct: (product: Product) => void;
}) {
  return (
    <article className="category-product">
      <ProductArtwork product={product} compact />
      <div className="category-product-copy">
        <h3>{product.name}</h3>
        <strong>{formatMoney(product.priceCents)}</strong>
      </div>
      <button
        type="button"
        className="add-button add-button-solid"
        disabled={isPending}
        onClick={() => onAddProduct(product)}
      >
        {isPending ? "Adding" : "Add"}
      </button>
    </article>
  );
}

function CartPanel({
  cart,
  isOpen,
  removingProductId,
  onClose,
  onRemoveLine,
}: {
  cart: Cart;
  isOpen: boolean;
  removingProductId: string | null;
  onClose: () => void;
  onRemoveLine: (productId: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <aside className="cart-popover" aria-label="Cart">
      <div className="cart-heading">
        <span className="cart-heading-icon" aria-hidden="true">
          <CartIcon />
        </span>
        <h2>Your Cart ({getCartItemCount(cart)})</h2>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close cart">
          <CloseIcon />
        </button>
      </div>

      {cart.lines.length === 0 ? (
        <div className="empty-cart">
          <strong>Your cart is empty</strong>
          <p>Add a product to see the cart update here.</p>
        </div>
      ) : (
        <div className="cart-lines">
          {cart.lines.map((line) => (
            <article className="cart-line" key={line.product.id}>
              <ProductArtwork product={line.product} mini />
              <div>
                <h3>{line.product.name}</h3>
                <p>
                  {formatMoney(line.product.priceCents)} x {line.quantity}
                </p>
              </div>
              <span className="line-quantity" aria-label={`Quantity ${line.quantity}`}>
                {line.quantity}
              </span>
              <strong>{formatMoney(line.lineSubtotalCents)}</strong>
              <button
                type="button"
                className="icon-button"
                disabled={removingProductId === line.product.id}
                onClick={() => onRemoveLine(line.product.id)}
                aria-label={`Remove ${line.product.name}`}
              >
                <CloseIcon />
              </button>
            </article>
          ))}
        </div>
      )}

      <div className="cart-total">
        <span>Grand Total</span>
        <strong>{formatMoney(cart.grandTotalCents)}</strong>
      </div>
    </aside>
  );
}

function FloatingFooter({
  cart,
  isOpen,
  onToggleCart,
}: {
  cart: Cart;
  isOpen: boolean;
  onToggleCart: () => void;
}) {
  const count = getCartItemCount(cart);
  return (
    <footer className="floating-footer" aria-label="Cart summary">
      <span className="footer-cart-icon" aria-hidden="true">
        <CartIcon />
      </span>
      <div className="footer-count">
        <strong>{pluralizeItems(count)}</strong>
        <span>{formatMoney(cart.grandTotalCents)} total</span>
      </div>
      <span className="footer-divider" aria-hidden="true" />
      <button type="button" className="view-cart-button" onClick={onToggleCart}>
        <CartIcon />
        {isOpen ? "Hide Cart" : `View Cart (${count})`}
      </button>
    </footer>
  );
}

function ProductArtwork({
  product,
  compact = false,
  mini = false,
}: {
  product: Product;
  compact?: boolean;
  mini?: boolean;
}) {
  const mode = mini ? "mini" : compact ? "compact" : "default";
  return (
    <div className={`product-art product-art-${product.category} product-art-${mode}`} aria-hidden="true">
      <div className="product-shadow" />
      <div className="product-shape">
        <CategoryIcon category={product.category} />
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <article className="product-card skeleton-card">
      <span className="skeleton-media" />
      <span className="skeleton-line wide" />
      <span className="skeleton-line short" />
      <span className="skeleton-button" />
    </article>
  );
}

function CategorySkeleton() {
  return (
    <section className="category-band skeleton-category" aria-hidden="true">
      <span className="skeleton-circle" />
      <span className="skeleton-line wide" />
      <span className="skeleton-line medium" />
    </section>
  );
}

function PawMark() {
  return (
    <svg viewBox="0 0 48 48" role="img" aria-label="Pet Circle Cart">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="17" r="4" fill="currentColor" />
      <circle cx="25" cy="13" r="4" fill="currentColor" />
      <circle cx="33" cy="19" r="4" fill="currentColor" />
      <path
        d="M15 32c2.2-7.1 15.5-8.2 18.1 0 1.1 3.5-2 6.3-5.3 4.8-2.5-1.2-4.2-1.2-6.7 0-3.2 1.5-7.1-1.1-6.1-4.8Z"
        fill="currentColor"
      />
      <path d="M30.5 37.5 39 29" fill="none" stroke="#ff644f" strokeLinecap="round" strokeWidth="4" />
      <path d="m39 29 3.5 4.5" fill="none" stroke="#ff644f" strokeLinecap="round" strokeWidth="4" />
    </svg>
  );
}

function CategoryIcon({ category }: { category: Category }) {
  if (category === "wet-food") return <CanIcon />;
  if (category === "treats") return <BoneIcon />;
  if (category === "toys") return <ToyIcon />;
  if (category === "healthcare") return <HealthIcon />;
  return <BowlIcon />;
}

function BowlIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M9 23h30l-3 12c-.7 2.7-3.1 4.5-5.9 4.5H17.9c-2.8 0-5.2-1.8-5.9-4.5L9 23Z" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M13 23c2-7 20-7 22 0" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      <circle cx="17" cy="17" r="2.5" fill="currentColor" />
      <circle cx="24" cy="14" r="2.5" fill="currentColor" />
      <circle cx="31" cy="17" r="2.5" fill="currentColor" />
    </svg>
  );
}

function CanIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <ellipse cx="24" cy="12" rx="13" ry="5" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M11 12v24c0 2.8 5.8 5 13 5s13-2.2 13-5V12" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M15 25h18" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function BoneIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <path
        d="M17.5 16.5a6.5 6.5 0 1 1 7.9 7.9l-1 1 3.2 3.2 1-1a6.5 6.5 0 1 1 7.9 7.9 6.5 6.5 0 1 1-7.9-7.9l-3.2-3.2-1 1a6.5 6.5 0 1 1-7.9-7.9Z"
        fill="none"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="3"
      />
    </svg>
  );
}

function ToyIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="13" fill="none" stroke="currentColor" strokeWidth="3" />
      <path d="M14 18c8 3 13 3 20 0M14 30c8-3 13-3 20 0M24 11c-3.5 8-3.5 18 0 26" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function HealthIcon() {
  return (
    <svg viewBox="0 0 48 48">
      <path d="M24 8 38 14v10c0 9-5.8 14.4-14 17-8.2-2.6-14-8-14-17V14L24 8Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="3" />
      <path d="M24 18v14M17 25h14" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M8 10h5l4.1 21.3a4 4 0 0 0 3.9 3.2h13.3a4 4 0 0 0 3.8-2.8L42 19H16" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
      <circle cx="22" cy="40" r="2.8" fill="currentColor" />
      <circle cx="35" cy="40" r="2.8" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
