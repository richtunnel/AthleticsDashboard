import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Opletics terms of service for using the platform.",
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
