import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `standalone` is only needed for production packaging and breaks local `next dev`
  // with the custom dist dir used by this repo.
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
