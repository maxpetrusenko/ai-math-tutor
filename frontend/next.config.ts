import path from "node:path";

import type { NextConfig } from "next";

const VERSIONED_AVATAR_MODEL_CACHE_CONTROL = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        source: "/avatars/nerdy-tutor.glb",
        headers: [
          {
            key: "Cache-Control",
            value: VERSIONED_AVATAR_MODEL_CACHE_CONTROL,
          },
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
