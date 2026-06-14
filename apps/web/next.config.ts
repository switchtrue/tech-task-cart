import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@cart/ui", "@cart/contracts"],
};

export default nextConfig;
