import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import ParentDashboardLayoutClient from "@/components/parent-dashboard/ParentDashboardLayout";

export default async function ParentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.email) {
    redirect("/onboarding/parent-signup");
  }

  // Check if user is a parent
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  // Allow access if user is PARENT role or has parent links
  if (user?.role !== "PARENT") {
    const parentLinks = await prisma.parentAthleteLink.findFirst({
      where: { parentUserId: user?.id },
    });
    
    if (!parentLinks) {
      redirect("/onboarding/parent");
    }
  }

  return (
    <ParentDashboardLayoutClient>
      {children}
    </ParentDashboardLayoutClient>
  );
}
