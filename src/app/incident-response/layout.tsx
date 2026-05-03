import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Incident Response Plan | Opletics",
  description: "Opletics incident response plan and security protocols.",
  alternates: {
    canonical: "/incident-response",
  },
};

export default function IncidentResponseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
