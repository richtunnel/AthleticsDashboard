"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./provider";
import { useEffect } from "react";
import { initMixpanel } from "@/lib/analytics/mixpanel.services";
import Script from "next/script";
import { AnalyticsProvider } from "./AnalyticsProvider";

import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AD Hub - Athletic Department Management",
  description: "Comprehensive athletic department management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && process.env.NEXTAUTH_URL !== "http://localhost:3000") {
      initMixpanel();
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
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
          <AnalyticsProvider />
          {children}
        </Providers>
      </body>
    </html>
  );
}
