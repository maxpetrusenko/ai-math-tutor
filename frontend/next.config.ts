import path from "node:path";

import type { NextConfig } from "next";

const APP_HTML_CACHE_CONTROL = "private, no-cache, no-store, max-age=0, must-revalidate";
const APP_HTML_ROUTES = [
  "/",
  "/avatar",
  "/dashboard",
  "/dev/avatar-concepts",
  "/lessons",
  "/login",
  "/models",
  "/profile",
  "/session",
  "/settings",
  "/signup",
];

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `standalone` is only needed for production packaging and breaks local `next dev`
  // with the custom dist dir used by this repo.
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  outputFileTracingRoot: path.resolve(__dirname),
  async headers() {
    return APP_HTML_ROUTES.map((source) => ({
      source,
      headers: [
        {
          key: "Cache-Control",
          value: APP_HTML_CACHE_CONTROL,
        },
      ],
    }));
  },
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
