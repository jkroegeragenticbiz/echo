import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source.
  transpilePackages: ["@echo/core", "@echo/db"],
  // Native/binary deps stay out of the server bundle.
  serverExternalPackages: ["ffmpeg-static", "linkedom", "@mozilla/readability"],
  // Make sure the ffmpeg binary is deployed with the routes that run media jobs.
  outputFileTracingIncludes: {
    "/api/saves": ["../../node_modules/ffmpeg-static/ffmpeg"],
    "/api/cron/process-media": ["../../node_modules/ffmpeg-static/ffmpeg"],
  },
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  poweredByHeader: false,
};

export default nextConfig;
