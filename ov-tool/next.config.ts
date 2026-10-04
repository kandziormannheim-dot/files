import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eigenständiger Server-Build für das Docker-Image (docker/Dockerfile)
  output: "standalone",
  poweredByHeader: false,
  // next dev soll CLAUDE.md nicht selbst ergänzen (Projektregeln pflegen wir von Hand)
  agentRules: false,
};

export default nextConfig;
