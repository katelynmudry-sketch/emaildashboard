import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Home dir has a stray empty package-lock.json that makes Next.js's
  // workspace-root inference pick the wrong directory — pin it explicitly.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
