import type { Metadata } from "next";
import HowItWorksContent from "./HowItWorksContent";

export const metadata: Metadata = {
  title: "How It Works | Opletics — Athletic Management Software for ADs & Coaches",
  description:
    "See how Opletics helps athletic directors and coaches automate sports schedules, sync to Google Calendar, send mass email campaigns, and connect with parents and other ADs — all in one platform.",
  keywords: [
    "how opletics works",
    "how athletic management software works",
    "how to automate sports schedule",
    "how to sync sports schedule to google calendar",
    "how to send emails from sports schedule",
    "athletic director tools explained",
    "how to manage athletic department",
    "schedule exchange for athletic directors",
    "AD collaboration platform",
    "parent communication for sports",
    "mass email for athletic departments",
    "sports schedule automation explained",
    "calendar sync for coaches",
    "how to organize athletic schedule",
    "athletic director communication platform",
    "opletics features",
    "sports management software overview",
    "school athletic software walkthrough",
    "how athletic directors manage schedules",
    "how to communicate with sports parents",
    "best way for athletic director to send emails",
    "athletic director schedule exchange",
    "AD to AD collaboration",
    "parent calendar sync sports",
    "how to automate my spreadsheet",
    "tools for athletic directors",
    "AI tools for ADs",
    "email campaigns for athletic departments",
    "schedule management for coaches",
    "school sports software how it works",
  ],
  alternates: {
    canonical: "/how-it-works",
  },
  openGraph: {
    title: "How It Works | Opletics — Athletic Management Software",
    description:
      "Opletics brings scheduling, calendar sync, mass email, AD collaboration, and parent communication into one platform built for athletic directors and coaches.",
    url: "/how-it-works",
    images: [
      {
        url: "/assets/images/opletic-dash-sample.png",
        width: 1200,
        height: 630,
        alt: "Opletics athletic management platform — how it works for athletic directors and coaches",
      },
    ],
  },
};

export default function HowItWorksPage() {
  return <HowItWorksContent />;
}
