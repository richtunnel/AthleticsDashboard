import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const THEME_STORAGE_KEY = "ad-hub-theme";

const themeScript = `
(function() {
  const storageKey = '${THEME_STORAGE_KEY}';
  try {
    const stored = window.localStorage.getItem(storageKey);
    let mode = null;

    if (stored) {
      const parsed = JSON.parse(stored);
      mode = parsed?.state?.mode;
    }

    if (mode !== 'light' && mode !== 'dark') {
      mode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.setProperty('color-scheme', mode);
  } catch (error) {
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.setProperty('color-scheme', 'light');
  }
})();
`;

export const metadata: Metadata = {
  title: "AD Hub - Athletic Department Management",
  description: "Comprehensive athletic department management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning data-theme="light" className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
