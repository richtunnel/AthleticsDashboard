import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "News Feed — Opletics",
  description: "Stay up to date with updates and moments from athletic directors across the country.",
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
