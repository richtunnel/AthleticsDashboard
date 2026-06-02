import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import type { ReactNode } from "react";

export const metadata = {
  title:       "Schedule Exchange Board — Opletics",
  description: "Browse open game dates posted by Athletic Directors. Find scheduling opportunities and request games directly.",
};

export default async function ScheduleBoardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login?callbackUrl=/schedule-board");
  }
  return <>{children}</>;
}
