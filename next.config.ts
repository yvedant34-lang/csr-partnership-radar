import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // seed/ JSON is imported by lib/config.ts; keep it in the server bundle.
  outputFileTracingIncludes: { "/**": ["./seed/radar_config.json"] },
};

export default nextConfig;
