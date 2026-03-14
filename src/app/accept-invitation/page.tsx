"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Chip,
} from "@mui/material";
import { Google, Person, Business } from "@mui/icons-material";
import BaseHeader from "@/components/headers/_base";
import TopFooter from "@/components/footer/topFooter";

interface InvitationDetails {
  email: string;
  role: string;
  ownerName: string;
  organizationName: string;
  ownerEmail: string;
  expiresAt: string;
}

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  const token = searchParams.get("token") || "";

  const acceptInvitation = useCallback(async () => {
    setAccepting(true);
    try {
      const res = await fetch("/api/collaboration/accept-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push(data.redirectUrl || "/dashboard?collaboration=accepted");
      } else {
        setError(data.message || "Failed to accept invitation");
        setAccepting(false);
      }
    } catch {
      setError("An error occurred while accepting the invitation");
      setAccepting(false);
    }
  }, [token, router]);

  // Fetch invitation details on mount
  useEffect(() => {
    if (!token) {
      setError("No invitation token provided");
      setLoading(false);
      return;
    }

    async function fetchInvitation() {
      try {
        const res = await fetch(
          `/api/collaboration/accept-invitation/details?token=${encodeURIComponent(token)}`
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.message || "Invalid invitation");
          setLoading(false);
          return;
        }

        setInvitation(data.invitation);
        setLoading(false);
      } catch {
        setError("Failed to load invitation details");
        setLoading(false);
      }
    }

    fetchInvitation();
  }, [token]);

  // If user is signed in, auto-accept
  useEffect(() => {
    if (status === "authenticated" && session?.user && invitation && !accepting && !error) {
      acceptInvitation();
    }
  }, [status, session, invitation, accepting, error, acceptInvitation]);

  const handleSignIn = () => {
    signIn("google", {
      callbackUrl: `/accept-invitation?token=${encodeURIComponent(token)}`,
    });
  };

  if (loading || (status === "authenticated" && !error)) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <BaseHeader pt="20px" pl="20px" />
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box sx={{ textAlign: "center" }}>
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography variant="h6">
              {accepting ? "Accepting invitation..." : "Loading invitation..."}
            </Typography>
          </Box>
        </Box>
        <TopFooter />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <BaseHeader pt="20px" pl="20px" />
        <Box sx={{ py: 8, px: 2, flex: 1 }}>
          <Container maxWidth="sm">
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Button variant="contained" onClick={() => router.push("/login")}>
              Go to Login
            </Button>
          </Container>
        </Box>
        <TopFooter />
      </Box>
    );
  }

  const roleLabel = invitation?.role === "VIEWER" ? "Viewer" : "Member";
  const roleDescription =
    invitation?.role === "VIEWER"
      ? "View schedules and data (read-only access)"
      : "View and manage schedules and data";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <BaseHeader pt="20px" pl="20px" />
      <Box sx={{ py: 8, px: 2, flex: 1 }}>
        <Container maxWidth="sm">
          <Typography variant="h4" fontWeight={700} textAlign="center" gutterBottom>
            You&apos;ve Been Invited
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            sx={{ mb: 4 }}
          >
            Sign in to accept the collaboration invite
          </Typography>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <Person color="primary" />
                <Typography variant="subtitle2" color="primary">
                  Invited by
                </Typography>
              </Box>
              <Typography variant="body1" fontWeight={600}>
                {invitation?.ownerName}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 2, mb: 1 }}>
                <Business fontSize="small" color="action" />
                <Typography variant="body2" color="text.secondary">
                  {invitation?.organizationName}
                </Typography>
              </Box>

              <Box sx={{ mt: 2 }}>
                <Chip
                  label={`${roleLabel} Access`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  {roleDescription}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body1" sx={{ mb: 3 }}>
              Sign in with Google to accept this invitation
            </Typography>

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<Google />}
              onClick={handleSignIn}
              sx={{ borderRadius: 2, py: 1.5, fontSize: "1rem" }}
            >
              Sign in with Google
            </Button>

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 2 }}
            >
              Use the email address: {invitation?.email}
            </Typography>
          </Card>
        </Container>
      </Box>
      <TopFooter />
    </Box>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense
      fallback={
        <Box sx={{ p: 4, textAlign: "center" }}>
          <CircularProgress />
        </Box>
      }
    >
      <AcceptInvitationContent />
    </Suspense>
  );
}
