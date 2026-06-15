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
import { TutorialTipsCard } from "@/components/settings/TutorialTipsCard";
import { ColumnIdentityModal } from "@/components/settings/ColumnIdentityModal";
import { PostScheduleToggle } from "@/components/settings/PostScheduleToggle";
import { canAccessSettings } from "@/lib/utils/rbac";
import { isMemberAccessToken } from "@/lib/utils/memberAccess";
import { AutoAwesome, AttachMoney, MenuBook, Inbox, InfoOutlined } from "@mui/icons-material";
import { Divider } from "@mui/material";
import { GameRequestsPanel } from "@/components/game-requests/GameRequestsPanel";
import Link from "next/link";

interface SettingsPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

/**
 * Resolve a human-readable plan name server-side, where both STRIPE_* (server-only)
 * and NEXT_PUBLIC_STRIPE_* env vars are accessible at runtime (not baked in at build time).
 * This avoids the "Opletics Plan" fallback when the client-side NEXT_PUBLIC_* values
 * don't match the production price IDs stored in the database.
 */
function resolveServerPlanName(
  sub:
    | {
        planNickname?: string | null;
        planLookupKey?: string | null;
        planType?: string | null;
        billingCycle?: string | null;
        priceId?: string | null;
      }
    | null
    | undefined,
): string | null {
  if (!sub) return null;

  // Prefer an explicit nickname stored on the subscription
  if (sub.planNickname) return sub.planNickname;

  // Look up by price ID — server has access to all env vars at runtime
  if (sub.priceId) {
    const map: Record<string, string> = {
      [process.env.STRIPE_STANDARD_PRICE_ID_MO ?? ""]: "Standard",
      [process.env.STRIPE_STANDARD_PRICE_ID_YR ?? ""]: "Standard",
      [process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_MO ?? ""]: "Standard",
      [process.env.NEXT_PUBLIC_STRIPE_STANDARD_PRICE_ID_YR ?? ""]: "Standard",
      [process.env.STRIPE_TEAM_PRICE_ID_MO ?? ""]: "Team",
      [process.env.STRIPE_TEAM_PRICE_ID_YR ?? ""]: "Team",
      [process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_MO ?? ""]: "Team",
      [process.env.NEXT_PUBLIC_STRIPE_TEAM_PRICE_ID_YR ?? ""]: "Team",
      [process.env.STRIPE_PLUS_PRICE_ID_MO ?? ""]: "Team+ (Plus)",
      [process.env.STRIPE_PLUS_PRICE_ID_YR ?? ""]: "Team+ (Plus)",
      [process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_MO ?? ""]: "Team+ (Plus)",
      [process.env.NEXT_PUBLIC_STRIPE_PLUS_PRICE_ID_YR ?? ""]: "Team+ (Plus)",
    };
    // Remove the empty-string key that forms when an env var is unset
    delete map[""];
    if (map[sub.priceId]) return map[sub.priceId];
  }

  // Fall back to planLookupKey (e.g. "standard_monthly")
  if (sub.planLookupKey) {
    const key = sub.planLookupKey.toLowerCase();
    if (key.includes("standard")) return "Standard";
    if (key.includes("team_plus") || key.includes("plus")) return "Team+ (Plus)";
    if (key.includes("team")) return "Team";
  }

  // Last resort: planType / billingCycle
  const cycle = (sub.planType ?? sub.billingCycle ?? "").toUpperCase();
  if (cycle === "MONTHLY") return "Standard";
  if (cycle === "ANNUAL") return "Standard";

  return null;
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
      schoolDistrict: true,
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
  const isCanceledAndExpired = subscriptionCanceledParam || (subscription?.status === "CANCELED" && (!subscription.currentPeriodEnd || subscription.currentPeriodEnd <= new Date()));

  if (isCanceledAndExpired && !checkoutStatus) {
    const periodEnd = subscription?.currentPeriodEnd;
    const dataRetentionEnd = periodEnd ? new Date(periodEnd.getTime() + 30 * 24 * 60 * 60 * 1000) : null;

    return (
      <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 700 }}>
        <Typography variant="h5" gutterBottom>
          Subscription Ended
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Your subscription has been canceled and your access period has ended. Resubscribe below to restore full dashboard access.
        </Typography>
        {dataRetentionEnd && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Your data is retained until <strong>{dataRetentionEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>. Resubscribing before that date will restore
            everything.
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
          resolvedPlanName={resolveServerPlanName(subscription)}
        />
      </Box>
    );
  }

  const generalContent = (
    <>
      <PaymentOverdueWarning />

      <UpgradePlanCard userPlan={user.plan} />

      <CalendarConnectionSection />

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
        resolvedPlanName={resolveServerPlanName(userWithSubscription?.subscription)}
      />

      <Typography sx={{ mb: 1, mt: 3, fontSize: { xs: "1.25rem", md: "1.5rem" } }} variant="h5">
        Account Details
      </Typography>
      <Box sx={{ mb: 3 }}>
        <AccountDetailsForm user={user} googleCalendarEmail={user.googleCalendarEmail ?? null} schoolEmail={user.schoolEmail ?? null} />
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

      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <MenuBook sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              Documentation
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Learn how to use every feature in Opletics — from scheduling games to managing teams, emails, and AI tools.
          </Typography>
          <Box
            component="a"
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              color: "primary.main",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            View Documentation →
          </Box>
        </CardContent>
      </Card>

      {/* Game Requests shortcut card */}
      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Inbox sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              Game Requests
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Review and manage incoming game requests from the Schedule Exchange Board.
          </Typography>
          <Box
            component={Link}
            href="/dashboard/posts?tab=3"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              color: "primary.main",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Manage Game Requests →
          </Box>
        </CardContent>
      </Card>

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
    <>
      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            Hide Menu Options
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Choose which items appear in your sidebar navigation. Hidden items can be restored at any time — your data is never deleted.
          </Typography>
          <MenuVisibilityToggles />
          <Divider sx={{ mb: 1.5, mt: 3 }} />

          {/* Score Tracker lives here because it controls whether the Scores menu appears in the sidebar. */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Score Tracker
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
              Enable score tracking to add game results and view team performance statistics. This adds the <strong>Scores</strong> menu to your sidebar.
            </Typography>
            <ScoreTrackerToggle />
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            Post Schedule Quick Link
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Show a <strong>Post Schedule</strong> button in Game Center so you can post your schedule to the Schedule Exchange Board without leaving the page.
          </Typography>
          <PostScheduleToggle />
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

      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <InfoOutlined sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              Column Identity
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Map your imported CSV column names to recognized data fields. Use this when your schedule columns use custom names that weren&apos;t automatically detected.
          </Typography>
          <ColumnIdentityModal />
        </CardContent>
      </Card>

      <TutorialTipsCard />
    </>
  );

  const gameRequestsContent = (
    <Box sx={{ pb: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
        Game Requests
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
        Review, approve, and manage game requests received from the Schedule Exchange Board.
      </Typography>
      <GameRequestsPanel context="settings" mode="all" />
    </Box>
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
        gameRequestsContent={gameRequestsContent}
      />
    </Box>
  );
}
