import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Card, CardContent, Typography, Box } from "@mui/material";
import { ConnectCalendarButton } from "@/components/calendar/ConnectCalendarButton";
import AccountDetailsForm from "@/components/settings/AccountDetailsForm";
import PasswordChangeForm from "@/components/settings/PasswordChangeForm";
import SubscriptionOverviewCard from "@/components/settings/SubscriptionOverviewCard";
import { getUserWithSubscription } from "@/lib/services/subscription";
import { GoogleCalendarSyncMenu } from "@/components/calendar/GoogleCalendarSyncMenu";
import SettingsTabs from "@/components/settings/SettingsTabs";

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
    // Defensive fallback
    throw new Error("User not found");
  }

  const isCalendarConnected = !!user?.googleCalendarRefreshToken;
  const hasPassword = !!user.hashedPassword;
  const hasGoogleAccount = user.accounts.some((account) => account.provider === "google");

  // Fetch subscription and login data
  const userWithSubscription = await getUserWithSubscription(session.user.id);

  return (
    <>
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>
        <Typography sx={{ mb: 3, fontSize: { xs: "1.25rem", md: "1.5rem" } }} variant="h5">
          Settings
        </Typography>

        <SettingsTabs
          user={user}
          isCalendarConnected={isCalendarConnected}
          hasPassword={hasPassword}
          hasGoogleAccount={hasGoogleAccount}
          userWithSubscription={userWithSubscription}
          checkoutStatus={checkoutStatus}
        />
      </Box>
    </>
  );
}
