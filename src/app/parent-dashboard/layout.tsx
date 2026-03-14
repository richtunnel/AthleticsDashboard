import { redirect } from "next/navigation";
import { getParentSession } from "@/lib/utils/parentSession";
import ParentDashboardLayoutClient from "@/components/parent-dashboard/ParentDashboardLayout";
import ParentSessionProvider from "@/components/providers/ParentSessionProvider";

export default async function ParentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getParentSession();

  if (!session?.user?.email) {
    redirect("/onboarding/parent-signup");
  }

  // getParentSession() already verifies the user is a parent
  // (either via parent cookie, or main cookie with parentAthleteLink records)

  return (
    <ParentSessionProvider>
      <ParentDashboardLayoutClient>
        {children}
      </ParentDashboardLayoutClient>
    </ParentSessionProvider>
  );
}
