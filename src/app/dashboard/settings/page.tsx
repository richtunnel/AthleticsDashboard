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
import { CollaboratorsSection } from "@/components/settings/CollaboratorsSection";
import { SettingsTabsClient } from "@/components/settings/SettingsTabsClient";
import { MenuVisibilityToggles } from "@/components/settings/MenuVisibilityToggles";
import { canAccessSettings } from "@/lib/utils/rbac";
import { isMemberAccessToken } from "@/lib/utils/memberAccess";
import { AutoAwesome, AttachMoney } from "@mui/icons-material";

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
  const subscriptionCanceledParam = params?.subscription_canceled === "true";

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
      googleCalendarEmail: true,
      googleCalendarRefreshToken: true,
      calendarTokenExpiry: true,
    },
  });

  if (!user) {
    redirect("/login");
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

  // Billing-only view when subscription period has ended after cancellation
  const subscription = userWithSubscription?.subscription;
  const isCanceledAndExpired =
    subscriptionCanceledParam ||
    (subscription?.status === "CANCELED" &&
      (!subscription.currentPeriodEnd || subscription.currentPeriodEnd <= new Date()));

  if (isCanceledAndExpired && !checkoutStatus) {
    const periodEnd = subscription?.currentPeriodEnd;
    const dataRetentionEnd = periodEnd
      ? new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000)
      : null;

    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 700 }}>
        <Typography variant="h5" gutterBottom>
          Subscription Ended
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Your subscription has been canceled and your access period has ended. Resubscribe below to restore full
          dashboard access.
        </Typography>
        {dataRetentionEnd && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your data is retained until{" "}
            <strong>
              {dataRetentionEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </strong>
            . Resubscribing before that date will restore everything.
          </Typography>
        )}
        <SubscriptionOverviewCard
          subscription={subscription || null}
          recoveryEmail={userWithSubscription?.recoveryEmail || null}
          lastLogin={userWithSubscription?.lastLogin || null}
          todayLoginCount={userWithSubscription?.todayLoginCount || 0}
          stripeCustomerId={userWithSubscription?.stripeCustomerId || null}
          userRole={userWithSubscription?.role || user.role}
          userPlan={user.plan}
          checkoutStatus={checkoutStatus}
        />
      </Box>
    );
  }

  const generalContent = (
    <>
      <PaymentOverdueWarning />

      <UpgradePlanCard userPlan={user.plan} />

      <CalendarConnectionSection />

      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            Score Tracker
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Enable score tracking to add game results and view team performance statistics. This adds score entry
            functionality to teams menu options.
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
            Reset your spreadsheet columns to the default layout. This is useful if you imported custom columns and want
            to return to the standard view.
          </Typography>
          <ResetColumnsButton />
        </CardContent>
      </Card>

      <EmailLimitsCard />

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

      <Typography sx={{ mb: 1, mt: 3, fontSize: { xs: "1.25rem", md: "1.5rem" } }} variant="h5">
        Account Details
      </Typography>
      <Box sx={{ mb: 3 }}>
        <AccountDetailsForm
          user={user}
          googleCalendarEmail={user.googleCalendarEmail ?? null}
          schoolEmail={user.schoolEmail ?? null}
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <SchoolDetailsForm user={user} />
      </Box>

      {!isMemberAccess && (
        <Box sx={{ mb: 3 }}>
          <PasswordChangeForm hasPassword={hasPassword} hasGoogleAccount={hasGoogleAccount} />
        </Box>
      )}

      <SupportCard />

      <DeleteAccountSection />
    </>
  );

  const costBudgetContent = (
    <>
      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            <AttachMoney sx={{ color: "text.secondary" }} /> Cost &amp; Budget Calculator
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Track and manage costs for your games. Set a monthly budget and monitor expenses throughout the season.
          </Typography>
          <CostBudgetToggle />
        </CardContent>
      </Card>

      <CostBudgetTab />
    </>
  );

  const aiFeaturesContent = (
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
  );

  const collaboratorContent = (
    <Box sx={{ pb: 3 }}>
      <CollaboratorsSection />
    </Box>
  );

  const otherContent = (
    <Card sx={{ mb: 3, boxShadow: "none!important" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
          Hide Menu Options
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
          Choose which items appear in your sidebar navigation. Hidden items can be restored at any time — your data is never deleted.
        </Typography>
        <MenuVisibilityToggles />
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>
      <Typography sx={{ mb: 2, fontWeight: 700 }} variant="h4">
        Settings
      </Typography>

      <SettingsTabsClient
        generalContent={generalContent}
        costBudgetContent={costBudgetContent}
        aiFeaturesContent={aiFeaturesContent}
        collaboratorContent={collaboratorContent}
        otherContent={otherContent}
      />
    </Box>
  );
}
