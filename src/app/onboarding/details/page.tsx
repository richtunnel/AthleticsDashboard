"use client";

import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Button, TextField, Typography, Link } from "@mui/material";
import styles from "@/styles/details_page.module.css";
import BaseHeader from "@/components/headers/_base";

export default function DetailsPage() {
  const router = useRouter();
  const [schoolName, setSchoolName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [mascot, setMascot] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const session = await getSession();
      if (!session) router.push("/onboarding/plans");
      setLoading(false);
    })();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/user/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolName, teamName, mascot }),
    });
    if (res.ok) router.push("/dashboard");
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <>
      <BaseHeader pt={"20px"} pl={"20px"} />
      <div className={`${styles.detailsContainer}`}>
        <Box sx={{ maxWidth: 400, mx: "auto" }}>
          <Typography variant="h4" gutterBottom>
            Enter School Details
          </Typography>
          <form onSubmit={handleSubmit}>
            <TextField size="small" fullWidth label="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} sx={{ mb: 2 }} required />
            <TextField size="small" fullWidth label="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} sx={{ mb: 2 }} required />
            <TextField size="small" fullWidth label="Mascot" value={mascot} onChange={(e) => setMascot(e.target.value)} sx={{ mb: 2 }} />
            <Button fullWidth variant="contained" type="submit">
              Complete Setup
            </Button>
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
