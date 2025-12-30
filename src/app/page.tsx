import type { Metadata } from "next";

import HomePageContent from "@/components/home/HomePageContent";

export const metadata: Metadata = {
  title: "Athletic Department Management",
  description: "Opletics helps athletic directors manage schedules, teams, opponents, venues, and calendar sync — all in one place.",
  alternates: {
    canonical: "/",
  },
};

export default function HomePage() {
  return <HomePageContent />;
}
