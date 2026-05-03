import type { Metadata } from "next";
import AboutClient from "./AboutClient";

export const metadata: Metadata = {
  title: "About Opletics | Revolutionizing Athletic Department Management",
  description:
    "Learn about Opletics, the premier athlete management system built by athletic directors for athletic departments. Our mission is to streamline sports scheduling and team management.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Opletics | Revolutionizing Athletic Department Management",
    description:
      "Learn about Opletics, the premier athlete management system built by athletic directors for athletic departments.",
    url: "/about",
  },
};

export default function AboutUsPage() {
  return <AboutClient />;
}
