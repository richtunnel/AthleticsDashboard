import type { Metadata } from "next";
import CareersClient from "./CareersClient";

export const metadata: Metadata = {
  title: "Careers at Opletics ",
  description: "Join the Opletics team and help us build the next generation of sports software and athlete management systems. Explore open positions in design, sales, and athletics.",
  keywords: [
    // ── Core ─────────────────────────────────────────────────────────────
    "opletics",
    "AMS",
    "new ams",
    "best ams",
    "athletic management system",
    "athletic management tool",
    "athletic management ai",
    "sports management",
    "league management",
    "sports software",
    "sports source",
    "sports-source",
    "sport-source",
    "sport source",
    "sports spreadsheet",
    // ── Audience / tools ──────────────────────────────────────────────────
    "tools for athletic directors",
    "tools for coaches",
    "tools for staff",
    "best athletic director tools",
    "software for athletic directors",
    "software for coaches",
    "athletic directors",
    "college tools",
    // ── Discovery ────────────────────────────────────────────────────────
    "hidden gems",
    "sports secrets",
    "secret dashboards",
    "product hunt",
    "fundraising",
    "sports agents",
    "espn",
    // ── Competitors ───────────────────────────────────────────────────────
    "Direct Athletics",
    "teamworks",
    "Teambuilder",
    "hubletics",
    "Kinduct",
    "athlete SR",
  ],
  alternates: {
    canonical: "/careers",
  },
  openGraph: {
    title: "Careers at Opletics",
    description: "Join the Opletics team and help us build the next generation of sports software and athlete management systems.",
    url: "/careers",
  },
};

export default function CareersPage() {
  return <CareersClient />;
}
