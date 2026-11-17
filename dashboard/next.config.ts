import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.DASHBOARD_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  devIndicators: { position: "bottom-right" },
  experimental: {
    agentUpgrade: "security",
  },
  // DuckDB is a native Node module: load it with Node's require instead of bundling it.
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
