import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Parent Portal",
  description: "Opletics Parent Portal keeps families up to date with real-time schedule changes and calendar sync.",
  alternates: {
    canonical: "/parents",
  },
  openGraph: {
    title: "Opletics Parent Portal",
    description: "A single source of truth for your athlete's schedule with real-time updates and smart notifications.",
    url: "/parents",
  },
};

export default function ParentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
