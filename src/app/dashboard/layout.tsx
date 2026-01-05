import type { Metadata } from "next";
import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";
import DashboardLayoutClient from "./DashboardLayoutClient";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      schoolName: true,
      teamName: true,
      schoolAddress: true,
    },
  });

  const hasSchoolDetails = Boolean(user?.schoolName?.trim()) && Boolean(user?.teamName?.trim()) && Boolean(user?.schoolAddress?.trim());

  if (!hasSchoolDetails) {
    redirect("/onboarding/details");
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
