import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about the team behind Opletics and our mission to modernize athletic department operations.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
