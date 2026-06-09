import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "What's Coming | Opletics v1.2 Platform Updates",
  description:
    "Explore what's next on the Opletics roadmap. From athlete profiles and compliance automation to recruiting pipelines and advanced analytics — see the features coming in v1.2.",
  keywords: [
    "opletics updates",
    "athlete management software",
    "v1.2 features",
    "athletic director software",
    "compliance automation",
    "recruiting management",
    "athlete profiles",
    "sports analytics",
    "eligibility tracking",
  ],
  alternates: {
    canonical: "/updates",
  },
};

export default function UpdatesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
