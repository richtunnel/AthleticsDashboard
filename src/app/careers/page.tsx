import type { Metadata } from "next";
import CareersClient from "./CareersClient";

export const metadata: Metadata = {
  title: "Careers at Opletics | Shaping the Future of Sports Technology",
  description:
    "Join the Opletics team and help us build the next generation of sports software and athlete management systems. Explore open positions in design, sales, and athletics.",
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
