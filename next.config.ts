/** @type {import('next').NextConfig} */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-dropzone", "file-selector"],

  // Enable standalone output for Docker
  output: "standalone",

  webpack: (config, { isServer }) => {
    if (isServer) {
      // SERVER-SIDE CONFIGURATION
      // 1. Exclude Prisma from bundling into the server-side code
      config.externals.push("@prisma/client");
    } else {
      // CLIENT-SIDE CONFIGURATION (isServer is FALSE)
      // 1. Provide fallbacks for Node.js core modules (like 'net' and 'fs') that are not available in the browser.
      // This is the essential fix for client components importing server dependencies (googleapis).
      config.resolve.fallback = {
        net: false,
        fs: false,
        child_process: false,
        crypto: false,
        stream: false,
        http2: false,
        zlib: false,
        url: false,
        qs: false,
        tls: false,
        buffer: false,
      };
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
