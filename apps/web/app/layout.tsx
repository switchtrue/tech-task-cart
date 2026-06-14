import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Pet Circle Cart",
  description: "A small pet ecommerce shopping cart take-home frontend.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
