import type { Metadata } from "next";
import ParentsClient from "./ParentsClient";

export const metadata: Metadata = {
  title: "Opletics Parents | Live Game Schedules for Football, Basketball, Soccer & More",
  description:
    "Follow your athlete's game schedule in real time. Opletics parent portal delivers live score tracking, calendar sync, and instant game day updates for football, basketball, soccer, volleyball, baseball, tennis, and track and field.",
  keywords: [
    // ── Sports ───────────────────────────────────────────────────────────
    "football",
    "basketball",
    "soccer",
    "baseball",
    "tennis",
    "volleyball",
    "futbol",
    "track and field",
    "minor leagues",
    "sports teams",
    "college tools",
    "game day",
    // ── Features ─────────────────────────────────────────────────────────
    "game schedule",
    "score tracker",
    "calendar sync",
    "easy game finder",
    "schedule games",
    "automate sports schedule",
    "athlete management",
    "athlete monitoring",
    // ── Core ─────────────────────────────────────────────────────────────
    "opletics",
    "AMS",
    "athletic management system",
    "sports management",
    "athletic directors",
    "adhub",
    "athletics hub",
    "centralized ams",
  ],
  alternates: {
    canonical: "/parents",
  },
  openGraph: {
    title: "Opletics Parents | Live Game Schedules for Football, Basketball, Soccer & More",
    description:
      "Follow your athlete's game schedule in real time. Live score tracking, calendar sync, and instant game day updates for every sport.",
    url: "/parents",
  },
};

export default function ParentPortalPage() {
  return <ParentsClient />;
}
