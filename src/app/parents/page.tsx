import type { Metadata } from "next";
import ParentsClient from "./ParentsClient";

export const metadata: Metadata = {
  title: "Parent Portal | Live Sports Schedules & Athlete Management",
  description:
    "Keep track of your child's sports schedule with the Opletics Parent Portal. Real-time updates, calendar integration, and a complete athlete management system for parents.",
  alternates: {
    canonical: "/parents",
  },
  openGraph: {
    title: "Parent Portal | Live Sports Schedules & Athlete Management",
    description:
      "Keep track of your child's sports schedule with the Opletics Parent Portal. Real-time updates and calendar integration.",
    url: "/parents",
  },
};

export default function ParentPortalPage() {
  return <ParentsClient />;
}
