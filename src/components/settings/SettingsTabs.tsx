"use client";

import { useState } from "react";
import { Box, Tabs, Tab, Card, CardContent, Typography } from "@mui/material";
import {
  AccountCircle as AccountCircleIcon,
  CreditCard as CreditCardIcon,
  Receipt as ReceiptIcon,
  CalendarMonth as CalendarMonthIcon,
} from "@mui/icons-material";
import AccountDetailsForm from "./AccountDetailsForm";
import PasswordChangeForm from "./PasswordChangeForm";
import SubscriptionOverviewCard from "./SubscriptionOverviewCard";
import PaymentHistory from "./PaymentHistory";
import { ConnectCalendarButton } from "@/components/calendar/ConnectCalendarButton";
import type { UserRole } from "@prisma/client";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    "aria-controls": `settings-tabpanel-${index}`,
  };
}

interface User {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  role: UserRole;
  plan: string | null;
  image: string | null;
  hashedPassword: string | null;
  organization: {
    id: string;
    name: string;
  };
  accounts: {
    provider: string;
  }[];
}

interface SubscriptionData {
  id: string;
  status: any;
  planType: any;
  billingCycle: string | null;
  priceId: string | null;
  planProductId: string | null;
  planLookupKey: string | null;
  planNickname: string | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: Date | null;
  deletionScheduledAt: Date | null;
  gracePeriodEndsAt: Date | null;
  stripeSubscriptionId: string | null;
}

interface RecoveryEmailData {
  id: string;
  email: string;
  verified: boolean;
}

interface LastLoginData {
  timestamp: Date;
  city: string | null;
  country: string | null;
}

interface UserWithSubscription {
  subscription: SubscriptionData | null;
  recoveryEmail: RecoveryEmailData | null;
  lastLogin: LastLoginData | null;
  todayLoginCount: number;
  stripeCustomerId: string | null;
  role: UserRole;
}

interface SettingsTabsProps {
  user: User;
  isCalendarConnected: boolean;
  hasPassword: boolean;
  hasGoogleAccount: boolean;
  userWithSubscription: UserWithSubscription | null;
  checkoutStatus: string | null;
}

export default function SettingsTabs({
  user,
  isCalendarConnected,
  hasPassword,
  hasGoogleAccount,
  userWithSubscription,
  checkoutStatus,
}: SettingsTabsProps) {
  const [value, setValue] = useState(0);

  const handleChange = (event: React.SyntheticEvent, newValue: number) => {
    setValue(newValue);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Tabs
          value={value}
          onChange={handleChange}
          aria-label="settings tabs"
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab icon={<AccountCircleIcon />} iconPosition="start" label="Account" {...a11yProps(0)} />
          <Tab icon={<CreditCardIcon />} iconPosition="start" label="Billing" {...a11yProps(1)} />
          <Tab icon={<ReceiptIcon />} iconPosition="start" label="Payment History" {...a11yProps(2)} />
          <Tab icon={<CalendarMonthIcon />} iconPosition="start" label="Integrations" {...a11yProps(3)} />
        </Tabs>
      </Box>

      <TabPanel value={value} index={0}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <Box>
            <Typography sx={{ mb: 2, fontSize: { xs: "1.25rem", md: "1.5rem" } }} variant="h5">
              Account Details
            </Typography>
            <AccountDetailsForm user={user} />
          </Box>
          <Box>
            <PasswordChangeForm hasPassword={hasPassword} hasGoogleAccount={hasGoogleAccount} />
          </Box>
        </Box>
      </TabPanel>

      <TabPanel value={value} index={1}>
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
      </TabPanel>

      <TabPanel value={value} index={2}>
        <PaymentHistory />
      </TabPanel>

      <TabPanel value={value} index={3}>
        <Card sx={{ boxShadow: "none!important" }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
              Google Calendar Integration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
              Connect your Google Calendar to automatically sync games and events.
            </Typography>
            <ConnectCalendarButton isConnected={isCalendarConnected} />
          </CardContent>
        </Card>
      </TabPanel>
    </Box>
  );
}
