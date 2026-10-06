import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server (.next/standalone) that the Dockerfile
  // copies as-is; without this the image would need all of node_modules.
  output: "standalone",
};

export default nextConfig;
