import type { Metadata } from "next";
import ParentsClient from "./ParentsClient";

export const metadata: Metadata = {
  title: "Opletics Parents | Live Game Schedules for Football, Basketball, Soccer & More",
  description:
    "Keep track of your child's sports schedule with the Opletics Parent Portal. Real-time updates, calendar integration, and a complete athlete management system for parents.",
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
      "Keep track of your child's sports schedule with the Opletics Parent Portal. Real-time updates and calendar integration.",
    url: "/parents",
  },
};

export default function ParentPortalPage() {
  return <ParentsClient />;
}
