/** @type {import('next').NextConfig} */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-dropzone", "file-selector"],

  // Enable standalone output for Docker
  output: "standalone",

  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push("@prisma/client");
    }
    return config;
  },

  // Bypass ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Bypass TypeScript errors during build
  typescript: {
    ignoreBuildErrors: false, // Set to true only if desperate
  },

  // Turbopack settings (Next.js 15)
  experimental: {
    turbo: {
      // Add any turbopack-specific settings here if needed
    },
  },
};

export default nextConfig;
