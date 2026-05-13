import type { Metadata } from "next";
import CareersClient from "./CareersClient";

export const metadata: Metadata = {
  title: "Careers at Opletics | Build the Best AMS & Sports Management Tools",
  description:
    "Join Opletics and help build the best AMS for athletic directors, coaches, and staff. We're creating the next generation of sports management software — tools for athletic directors, tools for coaches, and tools for staff that automate schedules, manage leagues, and power game day.",
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
    title: "Careers at Opletics | Build the Best AMS & Sports Management Tools",
    description:
      "Join Opletics and help build the best AMS for athletic directors, coaches, and staff. Creating the next generation of sports management software and tools for athletic departments.",
    url: "/careers",
  },
};

export default function CareersPage() {
  return <CareersClient />;
}
