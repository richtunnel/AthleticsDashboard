"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
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
  Divider,
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
  // The main session (next-auth.session-token) covers legacy collaborators and ADs.
  const { data: session, status, update } = useSession();
  // The collaborator session (collaborator-session-token) covers collaborators who
  // signed in via the isolated flow to avoid overwriting an AD's session.
  const [collaboratorSession, setCollaboratorSession] = useState<any>(null);
  const [collaboratorSessionStatus, setCollaboratorSessionStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEmailMismatch, setIsEmailMismatch] = useState(false);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);

  const isNonGmailInvitation = invitation && 
    !invitation.email.toLowerCase().endsWith("@gmail.com") && 
    !invitation.email.toLowerCase().endsWith("@googlemail.com");

  const urlToken = searchParams.get("token") || "";
  const [token, setToken] = useState(urlToken);
  const [tokenResolved, setTokenResolved] = useState(Boolean(urlToken));

  // When the token is missing from the URL (it gets dropped across the signup /
  // OAuth round-trip), fall back to the httpOnly pending-invitation cookie that
  // the email-link route already set — so the invitee never sees "No invitation
  // token provided" after signing up.
  useEffect(() => {
    if (urlToken) {
      setToken(urlToken);
      setTokenResolved(true);
      return;
    }
    let cancelled = false;
    fetch("/api/collaboration/accept-invitation/pending-token")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (d?.token) setToken(d.token);
        setTokenResolved(true);
      })
      .catch(() => {
        if (!cancelled) setTokenResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [urlToken]);

  // Poll the collaborator session endpoint on mount so we can detect a successful
  // sign-in through the isolated collaborator auth flow.
  useEffect(() => {
    fetch("/api/auth/collaborator/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user?.email) {
          setCollaboratorSession(data);
          setCollaboratorSessionStatus("authenticated");
        } else {
          setCollaboratorSessionStatus("unauthenticated");
        }
      })
      .catch(() => setCollaboratorSessionStatus("unauthenticated"));
  }, []);

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
        await update();
        router.push(data.redirectUrl || "/dashboard?collaboration=accepted");
      } else {
        setError(data.message || "Failed to accept invitation");
        setAccepting(false);
      }
    } catch {
      setError("An error occurred while accepting the invitation");
      setAccepting(false);
    }
  }, [token, router, update]);

  // Fetch invitation details on mount
  useEffect(() => {
    if (!tokenResolved) return; // wait for the cookie fallback to resolve first
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
  }, [token, tokenResolved]);

  // If user is signed in (main session OR collaborator session), auto-accept.
  // The active user is whichever session resolves first — collaborator takes
  // precedence since it was signed in specifically for this invitation flow.
  useEffect(() => {
    if (collaboratorSessionStatus === "loading" || status === "loading") return;
    if (!invitation || accepting || error) return;

    const activeUser = collaboratorSession?.user ?? (status === "authenticated" ? session?.user : null);
    if (!activeUser) return;

    if (activeUser.email?.toLowerCase() !== invitation.email.toLowerCase()) {
      setError(`You are signed in as ${activeUser.email}, but this invitation was sent to ${invitation.email}.`);
      setIsEmailMismatch(true);
    } else {
      acceptInvitation();
    }
  }, [status, session, collaboratorSession, collaboratorSessionStatus, invitation, accepting, error, acceptInvitation]);

  const handleSignIn = () => {
    // Use the isolated collaborator auth route so the sign-in writes to the
    // collaborator-session-token cookie and does not overwrite any active AD session.
    const callbackUrl = `/accept-invitation?token=${encodeURIComponent(token)}`;
    window.location.href = `/api/auth/collaborator/signin/google?callbackUrl=${encodeURIComponent(callbackUrl)}`;
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
            {isEmailMismatch ? (
              <Box sx={{ mt: 2 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body1">
                    This invitation was sent to <strong>{invitation?.email}</strong>, but you are currently signed in as <strong>{session?.user?.email}</strong>. 
                    Please sign out and sign in with the correct account to accept this invitation.
                  </Typography>
                  {isNonGmailInvitation && (
                    <Typography variant="body2" sx={{ mt: 1, fontStyle: "italic", color: "text.secondary" }}>
                      If you don&apos;t have a Google account, you can use the &quot;Sign Up&quot; or &quot;Log In&quot; options after signing out.
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="contained"
                  onClick={() => signOut({ callbackUrl: window.location.href })}
                >
                  Sign Out and Try Again
                </Button>
              </Box>
            ) : (
              <Button variant="contained" onClick={() => router.push("/login")}>
                Go to Login
              </Button>
            )}
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
              {isNonGmailInvitation 
                ? "Sign in to accept this invitation. Non-Gmail users can set up their account manually." 
                : "Sign in with Google to accept this invitation"}
            </Typography>

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<Google />}
              onClick={handleSignIn}
              sx={{ borderRadius: 2, py: 1.5, fontSize: "1rem", mb: isNonGmailInvitation ? 2 : 0 }}
            >
              Sign in with Google
            </Button>

            {isNonGmailInvitation && (
              <>
                <Divider sx={{ my: 2 }}>OR MANUAL SETUP</Divider>
                
                <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => router.push(`/signup?email=${encodeURIComponent(invitation?.email || "")}&callbackUrl=${encodeURIComponent(window.location.href)}`)}
                  >
                    Sign Up
                  </Button>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => router.push(`/login?email=${encodeURIComponent(invitation?.email || "")}&callbackUrl=${encodeURIComponent(window.location.href)}`)}
                  >
                    Log In
                  </Button>
                </Box>
                
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2, fontStyle: "italic" }}>
                  Note: If you don&apos;t have a Google account, please use the &quot;Sign Up&quot; button above to create an account with your email and a password.
                </Typography>
              </>
            )}

            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mt: 2 }}
            >
              Use the email address: <strong>{invitation?.email}</strong>
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
