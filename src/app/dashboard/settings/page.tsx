import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Card, CardContent, Typography, Box } from "@mui/material";
import { ConnectCalendarButton } from "@/components/calendar/ConnectCalendarButton";
import AccountDetailsForm from "@/components/settings/AccountDetailsForm";
import PasswordChangeForm from "@/components/settings/PasswordChangeForm";
import AccountRecoverySection from "@/components/settings/AccountRecoverySection";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
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
      accountRecoveries: {
        where: {
          used: false,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        select: {
          createdAt: true,
          expiresAt: true,
          used: true,
        },
      },
    },
  });

  if (!user) {
    // Defensive fallback
    throw new Error("User not found");
  }

  const isCalendarConnected = !!user?.googleCalendarRefreshToken;
  const hasPassword = !!user.hashedPassword;
  const hasGoogleAccount = user.accounts.some((account) => account.provider === "google");
  const lastRecovery = user.accountRecoveries.length > 0 ? user.accountRecoveries[0] : null;

  return (
    <>
      <Box sx={{ p: 3 }}>
        <Typography sx={{ mb: 1 }} variant="h5">
          Settings
        </Typography>

        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Google Calendar Integration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Connect your Google Calendar to automatically sync games and events.
            </Typography>
            <ConnectCalendarButton isConnected={isCalendarConnected} />
          </CardContent>
        </Card>
      </Box>
      <Box sx={{ p: 3 }}>
        <Typography sx={{ mb: 1 }} variant="h5">
          Account Details
        </Typography>
        <AccountDetailsForm user={user} />
      </Box>
      <Box sx={{ p: 3 }}>
        <PasswordChangeForm hasPassword={hasPassword} hasGoogleAccount={hasGoogleAccount} />
      </Box>
      <Box sx={{ p: 3 }}>
        <Typography sx={{ mb: 1 }} variant="h5">
          Account Recovery
        </Typography>
        <AccountRecoverySection lastRecovery={lastRecovery} />
      </Box>
    </>
  );
}
