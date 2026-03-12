"use client";

import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Card, CardContent, Button, Chip, CircularProgress, Alert, Divider, Grid } from "@mui/material";
import { CreditCard, ChildCare, Add, School } from "@mui/icons-material";
import Link from "next/link";
import { SupportFormWithDropdown } from "@/components/support/SupportFormWithDropdown";
import DeleteAccountSection from "@/components/settings/DeleteAccountSection";

interface ParentLink {
  id: string;
  childName: string;
  childGrade: string | null;
  sportName: string;
  sportLevel: string;
  schoolName: string;
  athleticDirectorName: string;
}

interface ParentSubscription {
  status: string;
  trialEnd: string | null;
  plan: string;
}

interface ParentOverviewData {
  links: ParentLink[];
  subscription: ParentSubscription | null;
}

async function fetchParentOverview(): Promise<ParentOverviewData> {
  const res = await fetch("/api/parent/overview");
  if (!res.ok) throw new Error("Failed to fetch settings data");
  return res.json();
}

export default function ParentSettingsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["parentOverview"],
    queryFn: fetchParentOverview,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Failed to load settings. Please try again.</Alert>;
  }

  const plan = data?.subscription?.plan || "parent_free";
  const isDonation = plan.includes("donation");
  const subscriptionStatus = data?.subscription?.status || "FREE";
  const links = data?.links || [];

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account and preferences
        </Typography>
      </Box>

      {/* Subscription */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CreditCard color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Subscription
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
            <Typography variant="body1">Current Plan:</Typography>
            <Chip label={isDonation ? "Donation Plan ($2.50/mo)" : "Free Plan"} color={isDonation ? "primary" : "success"} size="small" />
            {subscriptionStatus === "TRIALING" && <Chip label="Trial" size="small" variant="outlined" color="info" />}
          </Box>
          <Button variant="outlined" component={Link} href="/onboarding/parent/plans">
            Change Plan
          </Button>
        </CardContent>
      </Card>

      {/* My Children & Schools */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "left", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ChildCare color="primary" />
              <Typography variant="h6" fontWeight={600}>
                My Children & Schools
              </Typography>
            </Box>
            {links.length > 0 ? (
              <Button variant="contained" size="small" startIcon={<Add />} component={Link} href="/onboarding/parent">
                Add Child
              </Button>
            ) : (
              ""
            )}
          </Box>
          {links.length === 0 ? (
            <>
              <Typography variant="body2" color="text.secondary">
                No children linked yet. Add a child to get started.
              </Typography>
              <br />
              <Button variant="contained" size="small" startIcon={<Add />} component={Link} href="/onboarding/parent">
                Add Child
              </Button>
            </>
          ) : (
            <Grid container spacing={2}>
              {links.map((link) => (
                <Grid size={{ xs: 12, sm: 6 }} key={link.id}>
                  <Card variant="outlined">
                    <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {link.childName}
                        {link.childGrade && (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {" "}
                            (Grade {link.childGrade})
                          </Typography>
                        )}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                        <School fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                          {link.schoolName}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                        <Chip label={link.sportName} size="small" variant="outlined" />
                        <Chip label={link.sportLevel} size="small" variant="outlined" color="primary" />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Support */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
            Need Help? Create a Support Ticket
          </Typography>
          <SupportFormWithDropdown />
        </CardContent>
      </Card>

      {/* Delete Account */}
      <DeleteAccountSection />
    </Box>
  );
}
