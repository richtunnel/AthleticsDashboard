import type { Metadata } from "next";

import HomePageContent from "@/components/home/HomePageContent";
import faqsData from "@/data/faq";

export const metadata: Metadata = {
  title: "Opletics | #1 AMS & Athletic Management Software for Coaches & Directors",
  description:
    "Opletics is the best new AMS (athletic management system) built for athletic directors, coaches, and staff. Automate game schedules, sync calendars, manage leagues, track scores, and run email campaigns. The top alternative to Direct Athletics, Teamworks, Teambuilder, Kinduct, Athlete SR, sportsyou, and adhub.",
  keywords: [
    // ── Core product ──────────────────────────────────────────────────────
    "opletics",
    "AMS",
    "new ams",
    "best ams",
    "athletic management system",
    "athletic management tool",
    "athletic management ai",
    "sports management",
    "league management",
    "league management system",
    "sports software",
    // ── Features ──────────────────────────────────────────────────────────
    "campaign manager",
    "score tracker",
    "game schedule",
    "ad chat",
    "athletics chat",
    "athlete management",
    "easy game finder",
    "schedule games",
    "calendar sync",
    "automate workflow",
    "automate schedules",
    "automate games schedule",
    "automate sports schedule",
    "automate spreadsheet",
    "game day",
    "centralized ams",
    "athletes desk",
    "adhub",
    "athletics hub",
    "athlete monitoring",
    "smart athlete",
    // ── Audience ──────────────────────────────────────────────────────────
    "athletic directors",
    "software for athletic directors",
    "software for coaches",
    "tools for athletic directors",
    "tools for coaches",
    "tools for staff",
    "best athletic director tools",
    "college tools",
    // ── Competitor alternatives ───────────────────────────────────────────
    "Direct Athletics",
    "teamworks",
    "Teambuilder",
    "team builder",
    "Kinduct",
    "athlete SR",
    "hubletics",
    "sportsyou",
    "sports you",
    "product hunt",
    // ── Discovery ────────────────────────────────────────────────────────
    "hidden gems",
    "sports secrets",
    "secret platforms",
    "secret dashboards",
    "fundraising",
    "sports agents",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Opletics | #1 AMS & Athletic Management Software for Coaches & Directors",
    description:
      "The best new AMS for athletic directors, coaches, and staff. Automate game schedules, sync calendars, manage leagues, and track scores. #1 alternative to Direct Athletics, Teamworks, Teambuilder, and Kinduct.",
    url: "/",
    images: [
      {
        url: "/assets/images/opletic-dash-sample.png",
        width: 1200,
        height: 630,
        alt: "Opletics AMS dashboard — best athletic management software for athletic directors and coaches",
      },
    ],
  },
};

export default function HomePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqsData.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text:
          typeof item.a === "string"
            ? item.a
            : "Our platform speeds up the process for finding game dates, synchronizing your calendar, generating and tracking emails, artificial bus scheduling, schedule conflict detection and more.",
      },
    })),
  };

  // Manually fixing the text for the JSX ones if needed, or just hardcoding for now to be safe
  faqJsonLd.mainEntity[0].acceptedAnswer.text =
    "Our platform speeds up the process for finding game dates, synchronizing your calendar, generating and tracking emails, artificial bus scheduling, schedule conflict detection and more.";
  faqJsonLd.mainEntity[3].acceptedAnswer.text = "We are happy to help! You can reach out to us at support@opletics.com";

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <HomePageContent />
    </>
  );
}
