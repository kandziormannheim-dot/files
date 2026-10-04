import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eigenständiger Server-Build für das Docker-Image (docker/Dockerfile)
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
