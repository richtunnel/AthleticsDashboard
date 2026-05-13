import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About Opletics | AMS Trusted by NADC, NFHS & Athletic Directors Nationwide",
  description:
    "Learn about Opletics, the premier athlete management system built by athletic directors for athletic departments. Our mission is to streamline sports scheduling and team management.",
  keywords: [
    // ── Brand ────────────────────────────────────────────────────────────
    "opletics",
    "athletic",
    "hubletics",
    "sports management",
    "league management",
    "league management system",
    "AMS",
    "best ams",
    "new ams",
    "athletic management system",
    "athletic management tool",
    // ── Industry organisations ────────────────────────────────────────────
    "NADC",
    "National Athletic Directors Conference",
    "NFHS",
    "MOAA Symposium",
    "Minority Opportunities Athletic Association",
    "NADIIIAA",
    "NATYCAA",
    "National Association of Intercollegiate Athletics Athletics Directors Association",
    // ── Audience ──────────────────────────────────────────────────────────
    "athletic directors",
    "tools for athletic directors",
    "tools for coaches",
    "best athletic director tools",
    "college tools",
    // ── Discovery ────────────────────────────────────────────────────────
    "hidden gems",
    "sports secrets",
    "secret platforms",
    "fundraising",
    "sports agents",
    "espn",
    "product hunt",
    // ── Competitors ───────────────────────────────────────────────────────
    "Direct Athletics",
    "teamworks",
    "Kinduct",
    "athlete SR",
    "sportsyou",
    "adhub",
    "athletics hub",
  ],
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Opletics | AMS Trusted by NADC, NFHS & Athletic Directors Nationwide",
    description:
      "Learn about Opletics, the premier athlete management system built by athletic directors for athletic departments.",
    url: "/about",
  },
};

export default function AboutUsPage() {
  return <AboutClient />;
}
