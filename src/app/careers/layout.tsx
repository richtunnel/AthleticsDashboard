import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers | Opletics",
  description: "Join the Opletics team. View open positions and career opportunities.",
  alternates: {
    canonical: "/careers",
  },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
