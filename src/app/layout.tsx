"use client";

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./provider";
import { useEffect } from "react";
import { initMixpanel } from "@/lib/analytics/mixpanel.services";

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
    initMixpanel();
  }, []);

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
