"use client";

import { useState } from "react";
import { Box, Tabs, Tab, Typography, Card, CardContent } from "@mui/material";
import { AutoAwesome, AttachMoney, ManageAccounts } from "@mui/icons-material";
import AccountDetailsForm from "@/components/settings/AccountDetailsForm";
import SchoolDetailsForm from "@/components/settings/SchoolDetailsForm";
import PasswordChangeForm from "@/components/settings/PasswordChangeForm";
import SubscriptionOverviewCard from "@/components/settings/SubscriptionOverviewCard";
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
import type { PlanType, UserRole } from "@prisma/client";
import type { UserWithSubscription } from "@/lib/services/subscription";

interface SettingsUser {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  plan: PlanType;
  image: string | null;
  hashedPassword: string | null;
  schoolName: string | null;
  teamName: string | null;
  schoolAddress: string | null;
  schoolEmail: string | null;
  organization: { id: string; name: string } | null;
  accounts: { provider: string }[];
  googleCalendarRefreshToken: string | null;
  calendarTokenExpiry: Date | null;
}

interface SettingsTabsProps {
  user: SettingsUser;
  userWithSubscription: UserWithSubscription | null;
  checkoutStatus: string | null;
  hasPassword: boolean;
  hasGoogleAccount: boolean;
  isMemberAccess: boolean;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`settings-tabpanel-${index}`} aria-labelledby={`settings-tab-${index}`}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export function SettingsTabs({ user, userWithSubscription, checkoutStatus, hasPassword, hasGoogleAccount, isMemberAccess }: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>
      <Typography sx={{ mb: 2, fontWeight: 700 }} variant="h4">
        Settings
      </Typography>

      <PaymentOverdueWarning />

      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="Settings tabs">
          <Tab
            icon={<AttachMoney sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Cost & Budget"
            id="settings-tab-0"
            aria-controls="settings-tabpanel-0"
          />
          <Tab
            icon={<ManageAccounts sx={{ fontSize: 18 }} />}
            iconPosition="start"
            label="Account"
            id="settings-tab-1"
            aria-controls="settings-tabpanel-1"
          />
        </Tabs>
      </Box>

      {/* Cost & Budget Tab */}
      <TabPanel value={activeTab} index={0}>
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

        <CostBudgetTab />
      </TabPanel>

      {/* Account Tab */}
      <TabPanel value={activeTab} index={1}>
        <UpgradePlanCard userPlan={user.plan} />

        <CalendarConnectionSection />

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

        <CollaboratorsSection />

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

        <Box sx={{ pt: 2 }}>
          <Typography sx={{ mb: 1, fontSize: { xs: "1.25rem", md: "1.5rem" } }} variant="h5">
            Account Details
          </Typography>
          <AccountDetailsForm user={user} />
        </Box>

        <Box sx={{ pt: 2 }}>
          <SchoolDetailsForm user={user} />
        </Box>

        {!isMemberAccess && (
          <Box sx={{ pt: 2 }}>
            <PasswordChangeForm hasPassword={hasPassword} hasGoogleAccount={hasGoogleAccount} />
          </Box>
        )}

        <Box sx={{ pt: 2, pb: 2 }}>
          <SupportCard />
        </Box>

        <Box sx={{ pt: 2 }}>
          <DeleteAccountSection />
        </Box>
      </TabPanel>
    </Box>
  );
}
