import localFont from "next/font/local";

/**
 * Inter, self-hosted via next/font/local.
 *
 * Why this and not @fontsource or next/font/google:
 *  - next/font/google downloads from fonts.gstatic.com at BUILD time, which fails
 *    on the Docker build host (no route to Google) — that's why we left it.
 *  - @fontsource ships the woff2 locally (build-safe) BUT injects plain
 *    `font-display: swap` with NO preload, so the browser always paints a
 *    fallback first and then swaps to Inter — the visible font flicker.
 *
 * next/font/local gives us the best of both: the font files are bundled (zero
 * build-time network) AND Next preloads them + generates a metric-matched
 * fallback automatically. The font is ready before first paint, so only Inter
 * ever renders — no fallback flash, no layout shift.
 */
export const inter = localFont({
  src: [
    { path: "./inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "./inter-latin-ext-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  preload: true,
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
});
