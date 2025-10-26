import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/utils/authOptions";
import DashboardLayoutClient from "./DashboardLayoutClient";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/");
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>;
}
