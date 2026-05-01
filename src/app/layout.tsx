import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./provider";
import Script from "next/script";
import { AnalyticsProvider } from "./AnalyticsProvider";
import { MixpanelProvider } from "./mixpanel.provider";
import { Suspense } from "react";
import { ServiceWorkerRegistration } from "@/components/utils/ServiceWorkerRegistration";

import { getSiteUrl, getSiteUrlAsUrl } from "@/lib/utils/siteUrl";

import "./globals.css";
import "../styles/sortable-drag-drop.css";

const inter = Inter({ subsets: ["latin"] });

const siteUrl = getSiteUrl();

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Opletics",
  url: siteUrl,
  email: "support@opletics.com",
  sameAs: ["https://www.instagram.com/opletics", "https://facebook.com/opletics", "https://x.com/opletics"],
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Opletics",
  url: siteUrl,
};

const softwareAppJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Opletics",
  operatingSystem: "Web",
  applicationCategory: "BusinessApplication",
  offers: {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
  },
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How does this actually save me time as an athletic director, coach or staff?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our platform speeds up the process for finding game dates, synchronizing your calendar, generating and tracking emails, artificial bus scheduling, schedule conflict detection and more.",
      },
    },
    {
      "@type": "Question",
      name: "Explain automating my spreadsheet?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Start by creating an account importing your spreadsheet. Use our filters, email campaigns and AI tools to quickly update, track and send your games and schedules.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use this to keep track of data or analytics?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "At the moment you can keep track of all your leagues scores, any email transactions and games. Financial and other types of analytics in progress.",
      },
    },
    {
      "@type": "Question",
      name: "How do I get support?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We are happy to help! You can reach out to us at support@opletics.com",
      },
    },
  ],
};

export const metadata: Metadata = {
  metadataBase: getSiteUrlAsUrl(),
  title: {
    default: "Opletics | Premier Athletic Department Management Platform",
    template: "%s | Opletics",
  },
  description:
    "Opletics is the premier athletic department management platform designed for athletic directors and coaches. Streamline game scheduling, team management, and Google Calendar synchronization with our AI-powered tools.",
  applicationName: "Opletics",
  keywords: [
    "athletic department management",
    "athletics scheduling software",
    "sports scheduling",
    "athletic director software",
    "game schedule management",
    "google calendar sync",
    "high school sports management",
    "middle school athletics",
    "sports program coordinator",
    "automated game scheduling",
    "athletic department workflow",
    "AI sports scheduling",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Opletics",
    title: "Opletics | Premier Athletic Department Management Platform",
    description:
      "Streamline your athletic department with Opletics. AI-powered game scheduling, team management, and seamless Google Calendar sync for athletic directors and coaches.",
    images: [
      {
        url: "/assets/images/opletic-dash-sample.png",
        width: 1200,
        height: 630,
        alt: "Opletics dashboard preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Opletics | Premier Athletic Department Management Platform",
    description:
      "Streamline your athletic department with Opletics. AI-powered game scheduling, team management, and seamless Google Calendar sync.",
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
        <script
          id="ld-software"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareAppJsonLd) }}
        />
        <script id="ld-faq" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
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
      <body className={inter.className}>
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
