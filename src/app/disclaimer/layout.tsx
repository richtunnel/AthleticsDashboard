import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: "Important disclaimers and limitations for using Opletics.",
  alternates: {
    canonical: "/disclaimer",
  },
};

export default function DisclaimerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
