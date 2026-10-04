import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Eigenständiger Server-Build für das Docker-Image (docker/Dockerfile)
  output: "standalone",
  poweredByHeader: false,
  // Vorlagen werden zur Laufzeit gelesen; alles andere im Projektordner gehört nicht ins Image
  outputFileTracingIncludes: { "/**": ["./templates/**/*"] },
  outputFileTracingExcludes: {
    "/**": ["./.env*", "./docs/**", "./scripts/**", "./tests/**", "./docker/**", "./data/**", "./*.md", "./src/**/*.test.*"],
  },
  // next dev soll CLAUDE.md nicht selbst ergänzen (Projektregeln pflegen wir von Hand)
  agentRules: false,
  // Uploads (Unterschrift, Briefbogen, Anhänge, Transkripte) laufen über Server Actions
  experimental: { serverActions: { bodySizeLimit: "200mb" } },
};

export default nextConfig;
