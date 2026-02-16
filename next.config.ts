/** @type {import('next').NextConfig} */
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  transpilePackages: ["react-dropzone", "file-selector"],

  outputFileTracingIncludes: {
    "/": ["node_modules/.prisma/**"],
  },

  // Image optimization configuration
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 days
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
    ],
  },

  // webpack: (config, { isServer }) => {
  //   if (isServer) {
  //     // SERVER-SIDE CONFIGURATION
  //     // 1. Exclude Prisma from bundling into the server-side code
  //     config.externals.push("@prisma/client");
  //   }
  //
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

  // async headers() {
  //   const securityHeaders = [
  //     {
  //       key: 'X-DNS-Prefetch-Control',
  //       value: 'on'
  //     },
  //     {
  //       key: 'Strict-Transport-Security',
  //       value: 'max-age=63072000; includeSubDomains; preload'
  //     },
  //     {
  //       key: 'X-Frame-Options',
  //       value: 'DENY'
  //     },
  //     {
  //       key: 'X-Content-Type-Options',
  //       value: 'nosniff'
  //     },
  //     {
  //       key: 'X-XSS-Protection',
  //       value: '1; mode=block'
  //     },
  //     {
  //       key: 'Referrer-Policy',
  //       value: 'strict-origin-when-cross-origin'
  //     },
  //     {
  //       key: 'Permissions-Policy',
  //       value: 'camera=(), microphone=(), geolocation=()'
  //     },
  //     {
  //       key: 'Content-Security-Policy',
  //       value: [
  //         "default-src 'self'",
  //         "base-uri 'self'",
  //         "form-action 'self'",
  //         "frame-ancestors 'none'",
  //         "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://*.googletagmanager.com https://*.stripe.com",
  //         "script-src-elem 'self' 'unsafe-inline' https://*.google.com https://*.gstatic.com https://*.googletagmanager.com https://*.stripe.com",
  //         "style-src 'self' 'unsafe-inline' https://*.google.com https://*.gstatic.com https://fonts.googleapis.com",
  //         "img-src 'self' data: blob: https: *.googleusercontent.com",
  //         "font-src 'self' data: https://*.gstatic.com https://fonts.gstatic.com",
  //         "connect-src 'self' https: wss: *.google.com *.gstatic.com *.stripe.com *.googletagmanager.com",
  //         "frame-src 'self' https://*.google.com https://*.stripe.com",
  //         "worker-src 'self' blob:",
  //         "manifest-src 'self'",
  //         "upgrade-insecure-requests",
  //       ].join('; ')
  //     }
  //   ];

  //   return [
  //     {
  //       // Apply to all routes
  //       source: '/:path*',
  //       headers: securityHeaders,
  //     },
  //     {
  //       // Apply additional headers to API routes
  //       source: '/api/:path*',
  //       headers: [
  //         ...securityHeaders,
  //         {
  //           key: 'X-Api-Version',
  //           value: '1.0'
  //         }
  //       ]
  //     }
  //   ];
  // },

  async headers() {
    const securityHeaders = [
      {
        key: "X-DNS-Prefetch-Control",
        value: "on",
      },
      {
        key: "X-Frame-Options",
        value: "DENY",
      },
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
          "style-src 'self' 'unsafe-inline' https:",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data: https:",
          "connect-src 'self' https:",
        ].join("; "),
      },
    ];

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.(?<domain>.*)",
          },
        ],
        permanent: true,
        destination: "https://:domain/:path*",
      },
    ];
  },
};

export default nextConfig;
