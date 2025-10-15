"use client";

import { getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Button, TextField, Typography } from "@mui/material";

export default function DetailsPage() {
  // This export is crucial
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
    if (res.ok) router.push("/");
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ maxWidth: 400, mx: "auto", mt: 8 }}>
      <Typography variant="h4" gutterBottom>
        Enter School Details
      </Typography>
      <form onSubmit={handleSubmit}>
        <TextField fullWidth label="School Name" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label="Team Name" value={teamName} onChange={(e) => setTeamName(e.target.value)} sx={{ mb: 2 }} />
        <TextField fullWidth label="Mascot" value={mascot} onChange={(e) => setMascot(e.target.value)} sx={{ mb: 2 }} />
        <Button fullWidth variant="contained" type="submit">
          Complete Setup
        </Button>
      </form>
    </Box>
  );
}
