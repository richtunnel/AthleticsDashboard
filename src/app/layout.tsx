import type { Metadata } from "next";
import { Providers } from "./provider";
import Script from "next/script";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { MixpanelProvider } from "./mixpanel.provider";
import { Suspense } from "react";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";

import { getSiteUrl, getSiteUrlAsUrl } from "@/lib/utils/siteUrl";

import "./globals.css";
import "../styles/sortable-drag-drop.css";

const siteUrl = getSiteUrl();

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Opletics",
  url: siteUrl,
  logo: `${siteUrl}/favicon.ico`,
  email: "support@opletics.com",
  sameAs: ["https://www.instagram.com/opletics", "https://facebook.com/opletics", "https://x.com/opletics", "https://www.linkedin.com/company/opletics"],
  contactPoint: [
    {
      "@type": "ContactPoint",
      email: "support@opletics.com",
      contactType: "customer support",
    },
    {
      "@type": "ContactPoint",
      email: "sales@opletics.com",
      contactType: "sales",
    },
  ],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Opletics",
  url: siteUrl,
  potentialAction: {
    "@type": "SearchAction",
    target: `${siteUrl}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Opletics",
  operatingSystem: "Web, iOS, Android",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Sports Management Software",
  description:
    "The premier athletic management system (AMS) and sports software for athletic departments. The top alternative to Direct Athletics, Teamworks, Teambuilder, Kinduct, Athlete SR, and other AMS platforms. Centralize scheduling, calendars, and team management in one place.",
  featureList: [
    "AI-powered game scheduling",
    "Real-time Google Calendar synchronization",
    "Bulk email campaign management",
    "Automated travel time calculation",
    "League-wide conflict detection",
    "Direct Athletics & Teamworks alternative",
    "Athlete management system (AMS)",
    "Alternative to Teambuilder and team builder platforms",
    "Replaces Kinduct, Athlete SR, and legacy AMS tools",
    "Smart athlete and team monitoring",
    "Centralized AMS — athletes desk, adhub, and athletics hub",
  ],
  offers: {
    "@type": "AggregateOffer",
    lowPrice: "0",
    highPrice: "199",
    priceCurrency: "USD",
    offerCount: "4",
    offers: [
      {
        "@type": "Offer",
        name: "Starter",
        price: "0",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "49",
        priceCurrency: "USD",
      },
      {
        "@type": "Offer",
        name: "Elite",
        price: "199",
        priceCurrency: "USD",
      },
    ],
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    reviewCount: "120",
  },
};

export const metadata: Metadata = {
  metadataBase: getSiteUrlAsUrl(),
  title: {
    default: "Opletics | Athlete Management System & Sports Software",
    template: "%s | Opletics",
  },
  description:
    "Opletics is the premier sports software for athletic departments. Automate scheduling, sync calendars, and manage teams with our advanced athlete management system. The top-tier alternative to Direct Athletics and Teamworks.",
  applicationName: "Opletics",
  keywords: [
    "sports software",
    "direct athletics",
    "teamworks",
    "athlete management system",
    "athletic department management",
    "sports scheduling software",
    "league management",
    "high school sports software",
    "middle school athletics",
    "sports program coordinator",
    "automated game scheduling",
    "athletic department workflow",
    "AI sports scheduling",
    "Operating System for Sports",
    "Teambuilder",
    "team builder",
    "workout",
    "fitness",
    "AMS",
    "athletic management system",
    "athlete monitoring",
    "smart athlete",
    "Kinduct",
    "athlete SR",
    "athletes desk",
    "adhub",
    "athletics hub",
    "centralized ams",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Opletics",
    title: "Opletics | Athlete Management System & Sports Software",
    description:
      "Streamline your athletic department with Opletics. AI-powered game scheduling, team management, and seamless Google Calendar sync for athletic directors and coaches. The ultimate sports software solution.",
    images: [
      {
        url: "/assets/images/opletic-dash-sample.png",
        width: 1200,
        height: 630,
        alt: "Opletics Athlete Management System Dashboard showing sports schedule automation",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    site: "@opletics",
    creator: "@opletics",
    title: "Opletics | Athlete Management System & Sports Software",
    description: "Streamline your athletic department with Opletics. AI-powered game scheduling, team management, and seamless Google Calendar sync. The best athlete management system.",
    images: ["/assets/images/opletic-dash-sample.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  console.log("Current Env:", process.env.NODE_ENV);
  return (
    <html lang="en">
      {/* Built by Richard Stokes @ Visual Embassy */}
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#F6F8FB" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="rgb(17 17 17)" />
        <script id="ld-org" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
        <script id="ld-website" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }} />
        <script id="ld-software" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }} />
        {/* Google Analytics */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `}
        </Script>
      </head>
      <body>
        <Providers>
          <MixpanelProvider />
          <Suspense fallback={null}>
            <AnalyticsProvider />
          </Suspense>
          <ServiceWorkerRegistration />
          {children}
        </Providers>
      </body>
    </html>
  );
}
