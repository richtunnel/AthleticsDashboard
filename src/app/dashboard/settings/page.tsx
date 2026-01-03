import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Card, CardContent, Typography, Box, Tabs, Tab } from "@mui/material";
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
import { Assistant, AutoAwesome } from "@mui/icons-material";
import RoleAssignment from "@/components/settings/RoleAssignment";
import Link from "next/link";

interface SettingsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const params = await searchParams;
  const checkoutParam = params?.checkout;
  const checkoutStatus = Array.isArray(checkoutParam) ? checkoutParam[0] : (checkoutParam ?? null);
  const currentTab = (params?.tab as string) || "general";

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

  const isMember = user.role === "MEMBER";

  const hasPassword = !!user.hashedPassword;
  const hasGoogleAccount = user.accounts.some((account) => account.provider === "google");

  // Fetch subscription and login data
  const userWithSubscription = await getUserWithSubscription(session.user.id);

  return (
    <>
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 1, pt: 0 }}>
        <Typography sx={{ mb: 1, fontWeight: 700 }} variant="h4">
          Settings
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
          <Tabs value={currentTab}>
            <Tab label="General" value="general" component={Link} href="/dashboard/settings?tab=general" />
            <Tab label="Role Assignment" value="roles" component={Link} href="/dashboard/settings?tab=roles" />
          </Tabs>
        </Box>

        {currentTab === "general" && (
          <>
            {/* Payment overdue warning */}
            <PaymentOverdueWarning />

            {/* Upgrade Plan Card - only shown for free users */}
            <UpgradePlanCard userPlan={user.plan} />

            {/* Calendar Connection Section - uses incremental OAuth */}
            <CalendarConnectionSection />

            {/* Support Card */}
            <SupportCard />

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
                  <AISchedulerToggle disabled={isMember} />
                  <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
                    <AITravelTimesToggle disabled={isMember} />
                  </Box>
                  <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
                    <AIEmailGenerationToggle disabled={isMember} />
                  </Box>
                  <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 3 }}>
                    <BookDemoButton>Learn More</BookDemoButton>
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
                <ResetColumnsButton disabled={isMember} />
              </CardContent>
            </Card>

            <EmailLimitsCard />

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
              disabled={isMember}
            />

            <Box sx={{ p: 0, mt: 3 }}>
              <Typography sx={{ mb: 1, fontSize: { xs: "1.25rem", md: "1.5rem" } }} variant="h5">
                Account Details
              </Typography>

              <AccountDetailsForm user={user} disabled={isMember} />
            </Box>

            <Box sx={{ p: 0, mt: 3 }}>
              <SchoolDetailsForm user={user} disabled={isMember} />
            </Box>

            <Box sx={{ p: 0, mt: 3 }}>
              <PasswordChangeForm hasPassword={hasPassword} hasGoogleAccount={hasGoogleAccount} disabled={isMember} />
            </Box>

            <Box sx={{ p: 0, mt: 3 }}>
              <DeleteAccountSection disabled={isMember} />
            </Box>
          </>
        )}

        {currentTab === "roles" && (
          <Box sx={{ mt: 2 }}>
            <RoleAssignment />
          </Box>
        )}
      </Box>
    </>
  );
}
