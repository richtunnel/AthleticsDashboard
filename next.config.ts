/** @type {import('next').NextConfig} */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-dropzone", "file-selector"],

  // webpack: (config, { isServer }) => {
  //   if (isServer) {
  //     // SERVER-SIDE CONFIGURATION
  //     // 1. Exclude Prisma from bundling into the server-side code
  //     config.externals.push("@prisma/client");
  //   }

  //   return config;
  // },

  // Bypass ESLint errors during build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Bypass TypeScript errors during build
  typescript: {
    ignoreBuildErrors: true, // Set to true only if desperate
  },

  turbopack: {
    // ...
  },
};

export default nextConfig;
