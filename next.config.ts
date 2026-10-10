import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // "sitemap.xml" as a folder name is Next's metadata convention, so site sitemaps live at /sitemap and are served as .xml here.
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/s/:slug/sitemap.xml", destination: "/s/:slug/sitemap" },
        { source: "/d/:host/sitemap.xml", destination: "/d/:host/sitemap" },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
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
