import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify Recovery Email",
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyRecoveryEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
