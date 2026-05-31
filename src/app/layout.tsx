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

/**
 * Load Inter via next/font so the woff2 is preloaded at build time and
 * font-display is set to "optional" — the font is used on the first paint if
 * it's ready; otherwise the fallback is kept and NO swap occurs afterward.
 * This eliminates the FOUT / layout-shift that fontsource's `font-display: swap`
 * caused (text expanding once Inter loaded after the initial render).
 */
const inter = Inter({
  subsets: ["latin"],
  display: "optional",
  variable: "--font-inter",
  preload: true,
});

const siteUrl = getSiteUrl();

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Opletics",
  url: siteUrl,
  logo: `${siteUrl}/favicon.ico`,
  email: "support@opletics.com",
  sameAs: [
    "https://www.instagram.com/opletics",
    "https://facebook.com/opletics",
    "https://x.com/opletics",
    "https://www.linkedin.com/company/opletics",
    "https://www.crunchbase.com/organization/opletics",
    "https://www.producthunt.com/products/opletics",
  ],
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
    "AI-powered game scheduling and automate sports schedule",
    "Real-time Google Calendar sync — calendar sync for every game day",
    "Bulk email campaign manager for athletic departments",
    "Automated travel time calculation",
    "League management and league management system tools",
    "Score tracker and live game schedule updates",
    "AD chat and athletics chat built-in",
    "Easy game finder and schedule games in seconds",
    "Automate workflow, automate spreadsheet, automate games schedule",
    "Centralized AMS — athletes desk, adhub, and athletics hub in one place",
    "Best athletic director tools for football, basketball, soccer, volleyball, and more",
    "Alternative to Direct Athletics, Teamworks, Teambuilder, Kinduct, Athlete SR, sportsyou, and hubletics",
    "Smart athlete and athlete monitoring dashboard",
    "Tools for coaches, tools for athletic directors, tools for staff",
    "College tools and minor league management",
    "Spreadsheet automation software — automate google sheets tasks and excel workflows for athletic schedules",
    "Bulk email automation — send emails with google sheets or excel to parents and coaches at scale",
    "Google Sheets and Excel integration — organize sports data, filter game schedules, and build searchable spreadsheet databases",
    "AI spreadsheet assistant — ai-powered spreadsheet tools that automate repetitive school admin tasks",
    "Mass email tools for schools — send personalized emails from spreadsheets with one click",
    "Automated email reminders for games — send schedule updates automatically to parents and staff",
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
    default: "Opletics | AMS for Athletic Directors, Coaches & League Management",
    template: "%s | Opletics",
  },
  description:
    "Opletics is the premier sports software for athletic departments. Automate scheduling, sync calendars, and manage teams with our advanced athlete management system. The top-tier alternative to Direct Athletics and Teamworks.",
  applicationName: "Opletics",
  keywords: [
    // ── Core product ──────────────────────────────────────────────────────
    "opletics",
    "sports source",
    "sports-source",
    "sport-source",
    "sport source",
    "sports spreadsheet",
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
    "sports scheduling software",
    "automated game scheduling",
    "automate sports schedule",
    "automate games schedule",
    "automate schedules",
    "automate workflow",
    "automate spreadsheet",
    "calendar sync",
    "game schedule",
    "game day",
    "score tracker",
    "easy game finder",
    "schedule games",
    "campaign manager",
    "ad chat",
    "athletics chat",
    "athlete management",
    "athlete monitoring",
    "smart athlete",
    "centralized ams",
    "athletes desk",
    "adhub",
    "athletics hub",
    // ── Audience ──────────────────────────────────────────────────────────
    "athletic directors",
    "software for athletic directors",
    "software for coaches",
    "tools for athletic directors",
    "tools for coaches",
    "tools for staff",
    "best athletic director tools",
    "college tools",
    "AI sports scheduling",
    "athletic department management",
    "athletic department workflow",
    "sports program coordinator",
    "high school sports software",
    "middle school athletics",
    "Operating System for Sports",
    // ── Industry organisations ────────────────────────────────────────────
    "NADC",
    "National Athletic Directors Conference",
    "NFHS",
    "MOAA Symposium",
    "Minority Opportunities Athletic Association",
    "NADIIIAA",
    "NATYCAA",
    "National Association of Intercollegiate Athletics Athletics Directors Association",
    // ── Competitor alternatives ───────────────────────────────────────────
    "Direct Athletics",
    "direct athletics",
    "teamworks",
    "Teambuilder",
    "team builder",
    "Kinduct",
    "athlete SR",
    "hubletics",
    "sportsyou",
    "sports you",
    "espn",
    "product hunt",
    // ── Sports / verticals ────────────────────────────────────────────────
    "football",
    "basketball",
    "soccer",
    "baseball",
    "tennis",
    "volleyball",
    "futbol",
    "minor leagues",
    "track and field",
    "sports teams",
    // ── Discovery / unique ────────────────────────────────────────────────
    "secret platforms",
    "secret dashboards",
    "hidden gems",
    "sports secrets",
    "athletic",
    "fundraising",
    "sports agents",
    // ── Athletic Department Operations ────────────────────────────────────
    "athletic department management software",
    "athletic scheduling software",
    "sports administration software",
    "athletic program management tools",
    "school athletics management platform",
    "athletic director software",
    "high school athletic management system",
    "sports operations software for schools",
    "athletic event management software",
    "athletic department organization tools",
    "sports management software for schools",
    "athletic administration platform",
    "school sports management software",
    "athletic office workflow software",
    "athletic staff management tools",
    // ── Scheduling ────────────────────────────────────────────────────────
    "high school sports scheduling software",
    "game scheduling software for schools",
    "athletic calendar management tools",
    "team scheduling software for coaches",
    "sports event scheduling platform",
    "automated athletic scheduling",
    "sports schedule maker for schools",
    "athletic travel scheduling software",
    "sports season planning software",
    "school game scheduling system",
    "coach scheduling tools",
    "sports practice scheduling software",
    "sports calendar software",
    "athletic transportation scheduling",
    "school athletics calendar platform",
    // ── Coach Communication ───────────────────────────────────────────────
    "coach communication platform",
    "parent communication software for sports",
    "team communication software for schools",
    "sports messaging platform",
    "athletic staff communication tools",
    "athlete communication software",
    "team notification system",
    "sports communication app for coaches",
    "school sports communication platform",
    "coach email management software",
    "athletic department messaging software",
    "parent update software for athletics",
    "sports team email software",
    "team announcement platform",
    "coach parent messaging tools",
    // ── Fundraising ───────────────────────────────────────────────────────
    "booster club management software",
    "sports fundraising platform",
    "athletic fundraising tools",
    "school sports fundraising software",
    "booster club communication software",
    "fundraising software for athletic departments",
    "athletic donation tracking software",
    "team fundraising management platform",
    "booster club organization tools",
    "fundraising management for schools",
    "sports sponsorship tracking software",
    "athletic fundraising CRM",
    "school athletics donation platform",
    "sports booster software",
    "fundraising tools for coaches",
    // ── Budgeting + Finance ───────────────────────────────────────────────
    "athletic budget tracking software",
    "sports budget management tools",
    "athletic finance software",
    "school athletics budgeting platform",
    "team expense tracking software",
    "athletic travel budget software",
    "sports financial management tools",
    "athletic department accounting software",
    "school sports budget planner",
    "athletics purchasing management",
    "sports program expense tracking",
    "coach budget tracking tools",
    "athletic spending management software",
    "sports operations budgeting tools",
    "school athletics finance platform",
    // ── Workflow + Automation ─────────────────────────────────────────────
    "athletic workflow automation",
    "sports administration automation",
    "AI software for athletic departments",
    "athletic operations automation",
    "school sports workflow software",
    "athletic department productivity tools",
    "automate coach communication",
    "automate sports scheduling",
    "AI sports administration software",
    "athletic process management software",
    "sports management automation platform",
    "athletic task management software",
    "athletic department efficiency software",
    "sports operations dashboard",
    "automated athletic communication tools",
    // ── Search Intent / Pain Points ───────────────────────────────────────
    "how to manage an athletic department",
    "how athletic directors stay organized",
    "best software for athletic directors",
    "how to automate sports scheduling",
    "how to communicate with sports parents",
    "tools for high school athletic directors",
    "best apps for coaches",
    "how to organize school athletics",
    "how to simplify athletic administration",
    "ways to improve athletic department communication",
    "how to track athletic budgets",
    "how to manage booster clubs",
    "how schools organize sports schedules",
    "software to manage school athletics",
    "tools to reduce athletic admin work",
    // ── Long-Tail High Conversion ─────────────────────────────────────────
    "affordable athletic department software",
    "easy scheduling software for coaches",
    "all in one athletic management platform",
    "software for high school athletic directors",
    "sports scheduling and communication software",
    "athletic management software for small schools",
    "athletic software with parent communication",
    "cloud based athletic department software",
    "sports administration software for K-12 schools",
    "school athletic scheduling and budgeting software",
    // ── Content Angles ────────────────────────────────────────────────────
    "common problems athletic directors face",
    "how schools manage sports schedules",
    "reducing paperwork in athletic departments",
    "improving communication with sports parents",
    "organizing high school athletic programs",
    "athletic department productivity tips",
    "how coaches save time with automation",
    "streamlining athletic department operations",
    "digital tools for school athletics",
    "managing athletic travel efficiently",
    // ── Spreadsheet / Excel / Google Sheets ──────────────────────────────
    "school software",
    "spreadsheet automation software",
    "spreadsheet ai tools",
    "spreadsheet ai assistant",
    "ai spreadsheet organizer",
    "ai spreadsheet software",
    "ai spreadsheet search tool",
    "ai-powered spreadsheet tools",
    "smart spreadsheet tools",
    "spreadsheet management software",
    "spreadsheet workflow automation",
    "spreadsheet dashboard for coaches",
    "spreadsheet collaboration software",
    "spreadsheet tools for administrators",
    "spreadsheet reporting software",
    "spreadsheet search tools",
    "spreadsheet filtering tips",
    "school spreadsheet software",
    "best spreadsheet software for schools",
    "automate google sheets tasks",
    "automate excel workflows",
    "google sheets automation for schools",
    "excel automation for athletic departments",
    "google sheets formulas for sports schedules",
    "excel formulas for schedules",
    "how to organize athletic schedules",
    "how to sort spreadsheets faster",
    "excel help for beginners",
    "google sheets help for coaches",
    "automate repetitive spreadsheet tasks",
    "create searchable spreadsheets",
    "how to build a searchable database in google sheets",
    "how to track schedules in excel",
    "how to organize sports data in google sheets",
    "how to filter games in google sheets",
    "how to add filters in excel",
    "help sorting game schedule",
    "help creating spreadsheet search",
    "how to create a sports schedule spreadsheet",
    "team scheduling spreadsheet",
    "ai that automates spreadsheets",
    // ── Email / Communication Automation ─────────────────────────────────
    "bulk email software for schools",
    "mass email tools for schools",
    "email automation with excel",
    "email automation with google sheets",
    "how to send bulk emails in google sheets",
    "send personalized emails from spreadsheets",
    "how to email parents from spreadsheets",
    "how to send emails with google sheets",
    "how to send emails with excel",
    "sending emails with google sheets",
    "how can i send multiple emails to parents",
    "google sheets mail merge",
    "excel mail merge tutorial",
    "email merge for athletic departments",
    "parent communication software",
    "team email management",
    "automated email reminders for games",
    "send schedule updates automatically",
    "automated sports communication",
    "sports communication automation",
    "team notification software",
    "school messaging software",
    "coach parent communication tools",
    // ── AI / Automation ───────────────────────────────────────────────────
    "ai for athletic departments",
    "ai sports scheduling software",
    "ai assistant for schools",
    "ai workflow automation",
    "ai admin assistant for coaches",
    "ai scheduling assistant",
    "ai tools for school administrators",
    "ai tools for administrators",
    "ai productivity tools for coaches",
    "ai for sports management",
    "ai sports operations platform",
    "ai-powered school software",
    "ai data organization software",
    "ai software for scheduling games",
    "automate school operations with ai",
    "automate athletic department tasks",
    "smart scheduling assistant",
    // ── How-To / Search Intent ─────────────────────────────────────────────
    "how to create a game schedule",
    "how to create a teams list",
    "how do athletic directors schedule games",
    "how to organize game schedules",
    "easiest way to schedule games",
    "best way to manage team schedules",
    "how to track athletic schedules",
    "how to automate schedule updates",
    "how to reduce scheduling conflicts",
    "how to manage multiple team schedules",
    "how to organize athletic departments",
    "how to save time with spreadsheets",
    "how to automate school admin tasks",
    "how coaches manage schedules",
    "how to manage sports communications",
    "how to centralize athletic schedules",
    "how to search data in spreadsheets",
    "how to filter sports schedules",
    "how to create automated reports in google sheets",
    "how to manage school sports data",
    "tools to automate athletic administration",
    "how to schedule games for multiple teams",
    "how to organize a sports season",
    // ── Expanded Athletic / School ─────────────────────────────────────────
    "athletic department software",
    "game scheduling tools",
    "high school sports scheduling tools",
    "coach communication software",
    "athletic admin tools",
    "sports scheduling app for schools",
    "team management software",
    "school athletics software",
    "coach organization software",
    "scheduling software for athletic directors",
    "athletic calendar management",
    "sports operations software",
    "sports event planning software",
    "high school athletic management software",
    "software for managing athletic programs",
    "sports communication platform",
    "school sports admin software",
    "team roster management software",
    "scheduling conflicts in sports",
    "sports staff coordination tools",
    "booster club fundraising tools",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Opletics",
    title: "Opletics | AMS for Athletic Directors, Coaches & League Management",
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
    title: "Opletics | AMS for Athletic Directors & Coaches",
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
    <html lang="en" className={inter.variable}>
      {/* Built by Richard Stokes @ Visual Embassy */}
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
        <link rel="manifest" href="/manifest.json" />
        {/* SEO trust signals — not rendered as visible links */}
        <link rel="me" href="https://www.crunchbase.com/organization/opletics" />
        <link rel="me" href="https://www.producthunt.com/products/opletics" />
        <link rel="me" href="https://www.linkedin.com/company/opletics/" />
        <link rel="me" href="https://www.facebook.com/opletics" />
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
            gtag('config', 'AW-18186650529');
          `}
        </Script>
        {/* Meta Pixel base code — fires initial PageView; route-change PageViews are fired by AnalyticsProvider */}
        {process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID && (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID}');
                fbq('track', 'PageView');
              `}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_FACEBOOK_PIXEL_ID}&ev=PageView&noscript=1`}
                alt=""
              />
            </noscript>
          </>
        )}
      </head>
      <body>
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
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
