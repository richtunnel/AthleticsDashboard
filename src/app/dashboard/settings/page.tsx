import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Card, CardContent, Typography, Box } from "@mui/material";
import AccountDetailsForm from "@/components/settings/AccountDetailsForm";
import SchoolDetailsForm from "@/components/settings/SchoolDetailsForm";
import PasswordChangeForm from "@/components/settings/PasswordChangeForm";
import SubscriptionOverviewCard from "@/components/settings/SubscriptionOverviewCard";
import { getUserWithSubscription } from "@/lib/services/subscription";
import { AISchedulerToggle } from "@/components/settings/AISchedulerToggle";
import { AITravelTimesToggle } from "@/components/settings/AITravelTimesToggle";
import { AIEmailGenerationToggle } from "@/components/settings/AIEmailGenerationToggle";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";
import { PaymentOverdueWarning } from "@/components/settings/PaymentOverdueWarning";
import { EmailLimitsCard } from "@/components/settings/EmailLimitsCard";
import { ResetColumnsButton } from "@/components/settings/ResetColumnsButton";
import { CalendarConnectionSection } from "@/components/settings/CalendarConnectionSection";
import UpgradePlanCard from "@/components/settings/UpgradePlanCard";
import BookDemoButton from "@/components/buttons/BookDemoButton";
import { SupportCard } from "@/components/settings/SupportCard";
import { CostBudgetToggle } from "@/components/settings/CostBudgetToggle";
import { CostBudgetTab } from "@/components/settings/CostBudgetTab";
import { ScoreTrackerToggle } from "@/components/settings/ScoreTrackerToggle";
import { Assistant, AutoAwesome, AttachMoney } from "@mui/icons-material";

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

  const hasPassword = !!user.hashedPassword;
  const hasGoogleAccount = user.accounts.some((account) => account.provider === "google");

  // Fetch subscription and login data
  const userWithSubscription = await getUserWithSubscription(session.user.id);

  return (
    <>
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>
        <Typography sx={{ mb: 1, fontWeight: 700 }} variant="h4">
          Settings
        </Typography>

        {/* Payment overdue warning */}
        <PaymentOverdueWarning />

        {/* Upgrade Plan Card - only shown for free users */}
        <UpgradePlanCard userPlan={user.plan} />

        {/* Calendar Connection Section - uses incremental OAuth */}
        <CalendarConnectionSection />

        {/* AI Features Section - Disabled */}
        <Card sx={{ mb: 3, boxShadow: "none!important" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              <AutoAwesome sx={{ color: "lightgray" }} /> AI Features
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
              <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
                <BookDemoButton>Learn More</BookDemoButton>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Cost & Budget Calculator Section */}

        <Card sx={{ mb: 3, boxShadow: "none!important" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              <AttachMoney sx={{ color: "text.secondary" }} /> Cost & Budget Calculator
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
              Track and manage costs for your games. Set a monthly budget and monitor expenses throughout the season.
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <CostBudgetToggle />
            </Box>
          </CardContent>
        </Card>

        {/* Cost & Budget Analysis Tab - Shown when enabled */}
        <CostBudgetTab />
      </Box>

      <Box sx={{ pl: { md: "24px" }, pr: { md: "24px" } }}>
        {/* Score Tracker Section */}
        <Card sx={{ mb: 3, boxShadow: "none!important" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              Score Tracker
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
              Enable score tracking to add game results and view team performance statistics. This adds score entry functionality to teams menu options.
            </Typography>
            <ScoreTrackerToggle />
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
        {/* Support Card */}
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
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>
        <SupportCard />
      </Box>
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <DeleteAccountSection />
      </Box>
    </>
  );
}
