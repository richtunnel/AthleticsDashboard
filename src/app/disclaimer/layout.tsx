import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Disclaimer | Opletics",
  description: "Opletics platform disclaimer and limitations of liability.",
  alternates: {
    canonical: "/disclaimer",
  },
};

export default function DisclaimerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
