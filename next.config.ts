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
    // NOTE: do NOT set contentSecurityPolicy here. When any value is set,
    // Next.js adds Content-Disposition: attachment to /_next/image responses,
    // which causes Cloudflare to mark them DYNAMIC and bypass the edge cache.
    // SVG is disabled above, so sandbox protection is moot. The global CSP
    // header from headers() applies to these requests anyway.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "*.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        // Matches bucket.region.digitaloceanspaces.com (two subdomain levels — * only covers one)
        hostname: "*.*.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "*.cdn.digitaloceanspaces.com",
      },
      {
        protocol: "https",
        hostname: "*.*.cdn.digitaloceanspaces.com",
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

  async headers() {
    const securityHeaders = [
      {
        key: "X-DNS-Prefetch-Control",
        value: "on",
      },
      {
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
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
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.google.com https://*.gstatic.com https://*.googletagmanager.com https://*.stripe.com",
          "script-src-elem 'self' 'unsafe-inline' https://*.google.com https://*.gstatic.com https://*.googletagmanager.com https://*.stripe.com",
          "style-src 'self' 'unsafe-inline' https://*.google.com https://*.gstatic.com https://fonts.googleapis.com",
          "img-src 'self' data: blob: https: *.googleusercontent.com",
          "font-src 'self' data: https://*.gstatic.com https://fonts.gstatic.com",
          "connect-src 'self' https: wss: *.google.com *.gstatic.com *.stripe.com *.googletagmanager.com",
          "frame-src 'self' https://*.google.com https://*.stripe.com",
          "worker-src 'self' blob:",
          "manifest-src 'self'",
          "upgrade-insecure-requests",
        ].join("; "),
      },
    ];

    return [
      {
        // 1. GLOBAL SECURITY HEADERS
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // 2. STATIC ASSETS (Images, Fonts in /public)
        // Next.js handles /_next/static automatically, but /public needs this.
        source: "/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // DASHBOARD PAGES: Revalidate every time
        source: "/dashboard/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // API DATA: Strictly no caching
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
      {
        // NEXT.JS IMAGES: explicit s-maxage so Cloudflare edge-caches these.
        // Next.js sets max-age from minimumCacheTTL but omits s-maxage, which
        // Cloudflare needs to cache at the edge. Must match minimumCacheTTL (30d).
        source: "/_next/image",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, s-maxage=2592000, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // 4. PREFETCHED JSON (Next.js Data)
        // When users hover over links, Next.js fetches JSON. Cache it briefly.
        source: "/_next/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, s-maxage=300, stale-while-revalidate=60",
          },
        ],
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
