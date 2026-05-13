import type { Metadata } from "next";
import CareersClient from "./CareersClient";

export const metadata: Metadata = {
  title: "Careers at Opletics | Shaping the Future of Sports Technology",
  description:
    "Join the Opletics team and help us build the next generation of sports software and athlete management systems. Explore open positions in design, sales, and athletics.",
  keywords: [
    "Direct Athletics",
    "teamworks",
    "Teambuilder",
    "team builder",
    "AMS",
    "athletic management system",
    "athlete monitoring",
    "smart athlete",
    "Kinduct",
    "athlete SR",
    "athletes desk",
    "adhub",
    "athletics hub",
    "centralized ams",
  ],
  alternates: {
    canonical: "/careers",
  },
  openGraph: {
    title: "Careers at Opletics | Shaping the Future of Sports Technology",
    description:
      "Join the Opletics team and help us build the next generation of sports software and athlete management systems.",
    url: "/careers",
  },
};

export default function CareersPage() {
  return <CareersClient />;
}
