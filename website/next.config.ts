import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Static export: plain HTML/CSS/JS served by Cloudflare Workers static assets (see wrangler.jsonc).
  // Cache Components / PPR need a server, so they stay off here.
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    root,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
