"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Box, Card, CardContent, Typography, Button, CircularProgress, Alert, Container } from "@mui/material";
import { acceptInvitation } from "@/app/dashboard/settings/invitation-actions";
import { useSession } from "next-auth/react";

function InviteAcceptContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [orgName, setOrgName] = useState("");

  const token = searchParams.get("token");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push(`/login?callbackUrl=${encodeURIComponent(window.location.href)}`);
      return;
    }

    if (status === "authenticated" && token) {
      handleAccept();
    }
  }, [status, token]);

  const handleAccept = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);

    const res = await acceptInvitation(token);
    if (res.success) {
      setSuccess(true);
      setOrgName(res.organizationName || "the organization");
    } else {
      setError(res.error || "Failed to accept invitation");
    }
    setLoading(false);
  };

  if (status === "loading" || loading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 2 }}>
        <CircularProgress />
        <Typography>Processing your invitation...</Typography>
      </Box>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Card sx={{ boxShadow: 3 }}>
        <CardContent sx={{ p: 4, textAlign: "center" }}>
          {success ? (
            <>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: "success.main" }}>
                Welcome!
              </Typography>
              <Typography variant="body1" sx={{ mb: 4 }}>
                You have successfully joined <strong>{orgName}</strong>. You now have access to their dashboard.
              </Typography>
              <Button variant="contained" size="large" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 700, color: "error.main" }}>
                Invitation Error
              </Typography>
              <Alert severity="error" sx={{ mb: 4 }}>
                {error || "Invalid or expired invitation token."}
              </Alert>
              <Button variant="outlined" onClick={() => router.push("/")}>
                Back to Home
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Container>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box>}>
      <InviteAcceptContent />
    </Suspense>
  );
}
