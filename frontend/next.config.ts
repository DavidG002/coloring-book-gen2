import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a minimal, self-contained server build (.next/standalone) —
  // used by frontend/Dockerfile so the production image doesn't need to
  // carry node_modules or the full source tree. No effect on `next dev`.
  output: "standalone",
};

export default nextConfig;
