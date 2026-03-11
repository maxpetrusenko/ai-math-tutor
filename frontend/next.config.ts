import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
