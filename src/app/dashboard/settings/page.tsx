import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Card, CardContent, Typography, Box } from "@mui/material";
import { ConnectCalendarButton } from "@/components/calendar/ConnectCalendarButton";
import AccountDetailsForm from "@/components/settings/AccountDetailsForm";
import SchoolDetailsForm from "@/components/settings/SchoolDetailsForm";
import PasswordChangeForm from "@/components/settings/PasswordChangeForm";
import SubscriptionOverviewCard from "@/components/settings/SubscriptionOverviewCard";
import { getUserWithSubscription } from "@/lib/services/subscription";
import { GoogleCalendarSyncMenu } from "@/components/calendar/GoogleCalendarSyncMenu";
import { AutoCalendarSyncToggle } from "@/components/settings/AutoCalendarSyncToggle";
import { AISchedulerToggle } from "@/components/settings/AISchedulerToggle";
import { AITravelTimesToggle } from "@/components/settings/AITravelTimesToggle";
import { AIEmailGenerationToggle } from "@/components/settings/AIEmailGenerationToggle";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import { PaymentOverdueWarning } from "@/components/settings/PaymentOverdueWarning";
import { EmailLimitsCard } from "@/components/settings/EmailLimitsCard";
import { ResetColumnsButton } from "@/components/settings/ResetColumnsButton";

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
      mascot: true,
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
        <Typography sx={{ mb: 1, fontSize: { xs: "1.25rem", md: "1.5rem", lg: "2.125rem" } }} variant="h4">
          Settings
        </Typography>

        {/* Payment overdue warning */}
        <PaymentOverdueWarning />

        <Card sx={{ mb: 3, boxShadow: "none!important" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              Google Calendar Integration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
              Connect your Google Calendar to sync games and events.
            </Typography>
            <ConnectCalendarButton isConnected={isCalendarConnected} />
            {isCalendarConnected && (
              <Box sx={{ mt: 3, pt: 3, borderTop: "1px solid", borderColor: "divider" }}>
                <AutoCalendarSyncToggle />
              </Box>
            )}
          </CardContent>
        </Card>

        <Card sx={{ mb: 3, boxShadow: "none!important" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              AI Features
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
              Enable or disable AI-powered features to enhance your scheduling workflow.
            </Typography>
            
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <AISchedulerToggle />
              <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
                <AITravelTimesToggle />
              </Box>
              <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
                <AIEmailGenerationToggle />
              </Box>
            </Box>
          </CardContent>
        </Card>

        <Card sx={{ mb: 3, boxShadow: "none!important" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              Spreadsheet Columns
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
              Reset your spreadsheet columns to the default layout. This is useful if you imported custom columns and want to return to the standard view.
            </Typography>
            <ResetColumnsButton />
          </CardContent>
        </Card>

        <EmailLimitsCard />
      </Box>

      {/* Billing & Subscription Card */}
      <SubscriptionOverviewCard
        subscription={userWithSubscription?.subscription || null}
        recoveryEmail={userWithSubscription?.recoveryEmail || null}
        lastLogin={userWithSubscription?.lastLogin || null}
        todayLoginCount={userWithSubscription?.todayLoginCount || 0}
        stripeCustomerId={userWithSubscription?.stripeCustomerId || null}
        userRole={userWithSubscription?.role || user.role}
        userPlan={user.plan}
        checkoutStatus={checkoutStatus}
      />
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography sx={{ mb: 1, fontSize: { xs: "1.25rem", md: "1.5rem" } }} variant="h5">
          Account Details
        </Typography>

        <AccountDetailsForm user={user} />
      </Box>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <SchoolDetailsForm user={user} />
      </Box>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <PasswordChangeForm hasPassword={hasPassword} hasGoogleAccount={hasGoogleAccount} />
      </Box>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <DeleteAccountSection />
      </Box>
    </>
  );
}
