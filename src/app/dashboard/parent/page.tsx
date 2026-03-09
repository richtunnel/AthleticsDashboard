"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  CircularProgress,
  Alert,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from "@mui/material";
import {
  CalendarMonth,
  Notifications,
  Sync,
  School,
  Sports,
  EmojiEvents,
  Check,
} from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";

interface ParentProfile {
  name: string | null;
  email: string;
  plan: string | null;
  customFields: any;
  role: string;
}

export default function ParentDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ParentProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
      return;
    }

    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);

        // Check if user is actually a parent
        if (data.role !== "PARENT") {
          router.push("/dashboard");
          return;
        }
      } else {
        setError("Failed to load profile");
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <>
        <BaseHeader pt="20px" pl="20px" />
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
          <CircularProgress />
        </Box>
      </>
    );
  }

  const parentInfo = profile?.customFields || {};
  const isDonationPlan = profile?.plan?.includes("donation");

  return (
    <>
      <BaseHeader pt="20px" pl="20px" />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome, {profile?.name || "Parent"}!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Your child&apos;s athletic schedule at your fingertips
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Grid container spacing={4}>
          {/* Profile Summary */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Your Profile
                </Typography>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <School color="primary" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      School
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ ml: 3 }}>
                    {parentInfo.schoolName || "Not selected"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Sports color="primary" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      Sport
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ ml: 3 }}>
                    {parentInfo.sportName || "Not selected"}
                  </Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <EmojiEvents color="primary" fontSize="small" />
                    <Typography variant="body2" color="text.secondary">
                      Level
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ ml: 3 }}>
                    {parentInfo.level || "Not selected"}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="body2" color="text.secondary">
                    Plan
                  </Typography>
                  <Chip
                    label={isDonationPlan ? "Donation Plan" : "Free Plan"}
                    color={isDonationPlan ? "primary" : "success"}
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Features */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Your Features
                </Typography>

                <List dense>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Check color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Calendar sync" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Check color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Mobile notifications" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Check color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Real-time schedule updates" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Check color="success" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="Game details and locations" />
                  </ListItem>
                  {isDonationPlan && (
                    <ListItem>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <Check color="primary" fontSize="small" />
                      </ListItemIcon>
                      <ListItemText primary="Priority support" />
                    </ListItem>
                  )}
                </List>

                {!isDonationPlan && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="outlined"
                      fullWidth
                      size="small"
                      onClick={() => router.push("/onboarding/parent/plans")}
                    >
                      Upgrade to Donation Plan
                    </Button>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Quick Actions */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Quick Actions
                </Typography>

                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<CalendarMonth />}
                    fullWidth
                    onClick={() => router.push("/parent-dashboard/calendars")}
                  >
                    Subscribe to Calendars
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<Sync />}
                    fullWidth
                    onClick={() => router.push("/parent-dashboard/calendars")}
                  >
                    Get Calendar Links
                  </Button>

                  <Button
                    variant="outlined"
                    startIcon={<Notifications />}
                    fullWidth
                    disabled
                  >
                    Notification Settings (Coming Soon)
                  </Button>
                </Box>

                <Alert severity="info" sx={{ mt: 3 }}>
                  Subscribe to your child&apos;s game schedules using iCal links. No login required!
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}
