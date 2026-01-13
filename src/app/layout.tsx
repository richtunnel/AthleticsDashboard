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

export const metadata: Metadata = {
  metadataBase: getSiteUrlAsUrl(),
  title: {
    default: "Opletics",
    template: "%s | Opletics",
  },
  description: "Opletics is an athletic department management platform to schedule games, manage teams, and sync with Google Calendar.",
  applicationName: "Opletics",
  keywords: ["athletic department management", "athletics scheduling software", "sports scheduling", "athletic director software", "game schedule management", "google calendar sync"],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Opletics",
    title: "Opletics",
    description: "Athletic department management platform to schedule games, manage teams, and sync with Google Calendar.",
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
    title: "Opletics",
    description: "Athletic department management platform to schedule games, manage teams, and sync with Google Calendar.",
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
        {/* Google Analytics Script */}
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
