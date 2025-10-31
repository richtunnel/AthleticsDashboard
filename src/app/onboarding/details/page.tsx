"use client";

import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, TextField, Typography, Link, Alert } from "@mui/material";
import styles from "@/styles/details_page.module.css";
import BaseHeader from "@/components/headers/_base";
import { AuthActionButton } from "@/components/auth/AuthActionButton";

export default function DetailsPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [mascot, setMascot] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) router.push("/onboarding/plans");
      setLoading(false);
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolName, teamName, mascot }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to update school details. Please try again.");
        setSubmitting(false);
        return;
      }

      // Success - redirect to dashboard
      router.push("/dashboard");
    } catch (err) {
      setError("An error occurred. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <div className={`${styles.detailsContainer}`}>
        <Box sx={{ maxWidth: 400, mx: "auto" }}>
          <Typography variant="h4" sx={{ fontWeight: "600" }} gutterBottom>
            Enter School Details
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <form onSubmit={handleSubmit}>
            <TextField 
              size="small" 
              fullWidth 
              label="School Name" 
              value={schoolName} 
              onChange={(e) => setSchoolName(e.target.value)} 
              sx={{ mb: 2 }} 
              required 
              disabled={submitting}
            />
            <TextField 
              size="small" 
              fullWidth 
              label="Team Name" 
              value={teamName} 
              onChange={(e) => setTeamName(e.target.value)} 
              sx={{ mb: 2 }} 
              required 
              disabled={submitting}
            />
            <TextField 
              size="small" 
              fullWidth 
              label="Mascot" 
              value={mascot} 
              onChange={(e) => setMascot(e.target.value)} 
              sx={{ mb: 2 }}
              disabled={submitting}
            />
            <AuthActionButton 
              fullWidth 
              variant="contained" 
              type="submit"
              loading={submitting}
              disabled={submitting || !schoolName || !teamName}
            >
              Complete Setup
            </AuthActionButton>
            <Typography variant="body2" sx={{ mt: 2, textAlign: "center" }}>
              By clicking "Complete Setup", you agree to our{" "}
              <Link href="/terms" underline="hover">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" underline="hover">
                Privacy Policy
              </Link>
              .
            </Typography>
          </form>
        </Box>
      </div>
    </>
  );
}
