import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Let phones on the same Wi-Fi open the dev server (e.g. http://192.168.x.x:3000).
  // Without this, Next blocks dev scripts cross-origin and nothing on the page is clickable.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [{ source: "/", destination: "/reviews", permanent: false }];
  },
};

export default nextConfig;
