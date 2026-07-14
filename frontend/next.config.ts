import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // `standalone` is only needed for production packaging and breaks local `next dev`
  // with the custom dist dir used by this repo.
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,
  outputFileTracingRoot: path.resolve(__dirname),
  experimental: {
    devtoolSegmentExplorer: false,
  },
};

export default nextConfig;
