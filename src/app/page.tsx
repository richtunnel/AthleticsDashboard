import type { Metadata } from "next";

import HomePageContent from "@/components/home/HomePageContent";
import faqsData from "@/data/faq";

export const metadata: Metadata = {
  title: "Opletics | The Ultimate Athlete Management System & Sports Software",
  description:
    "Opletics is the premier sports software for athletic departments. Automate scheduling, sync calendars, and manage teams with our advanced athlete management system. Empowering athletic directors and coaches with AI-driven tools.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Opletics | The Ultimate Athlete Management System & Sports Software",
    description:
      "The premier sports software for athletic departments. Automate scheduling, sync calendars, and manage teams with Opletics.",
    url: "/",
    images: [
      {
        url: "/assets/images/opletic-dash-sample.png",
        width: 1200,
        height: 630,
        alt: "Opletics Athlete Management System Dashboard",
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
        text: typeof item.a === "string" ? item.a : "Our platform speeds up the process for finding game dates, synchronizing your calendar, generating and tracking emails, artificial bus scheduling, schedule conflict detection and more.",
      },
    })),
  };

  // Manually fixing the text for the JSX ones if needed, or just hardcoding for now to be safe
  faqJsonLd.mainEntity[0].acceptedAnswer.text = "Our platform speeds up the process for finding game dates, synchronizing your calendar, generating and tracking emails, artificial bus scheduling, schedule conflict detection and more.";
  faqJsonLd.mainEntity[3].acceptedAnswer.text = "We are happy to help! You can reach out to us at support@opletics.com";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomePageContent />
    </>
  );
}
