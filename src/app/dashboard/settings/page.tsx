import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Box, Typography } from "@mui/material";
import { getUserWithSubscription } from "@/lib/services/subscription";
import { canAccessSettings } from "@/lib/utils/rbac";
import { isMemberAccessToken } from "@/lib/utils/memberAccess";
import { SettingsTabs } from "@/components/settings/SettingsTabs";

interface SettingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const checkoutParam = params?.checkout;
  const checkoutStatus = Array.isArray(checkoutParam) ? checkoutParam[0] : (checkoutParam ?? null);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      plan: true,
      image: true,
      hashedPassword: true,
      schoolName: true,
      teamName: true,
      schoolAddress: true,
      schoolEmail: true,
      organization: {
        select: {
          id: true,
          name: true,
        },
      },
      accounts: {
        select: {
          provider: true,
        },
      },
      googleCalendarRefreshToken: true,
      calendarTokenExpiry: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const hasPassword = !!user.hashedPassword;
  const hasGoogleAccount = user.accounts.some((account) => account.provider === "google");

  const isMemberAccess = isMemberAccessToken({ email: user.email, organizationId: user.organization?.id });

  const userWithSubscription = await getUserWithSubscription(session.user.id);

  const settingsAccess = await canAccessSettings();
  if (!settingsAccess.canAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Access Denied
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {settingsAccess.reason}
        </Typography>
      </Box>
    );
  }

  return (
    <SettingsTabs
      user={user}
      userWithSubscription={userWithSubscription}
      checkoutStatus={checkoutStatus}
      hasPassword={hasPassword}
      hasGoogleAccount={hasGoogleAccount}
      isMemberAccess={isMemberAccess}
    />
  );
}
