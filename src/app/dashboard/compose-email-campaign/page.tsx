"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Box, Button, TextField, Typography, Select, MenuItem, Alert } from "@mui/material";

export default function ComposeEmailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      fetchGroups();
    }
  }, [status, router]);

  const fetchGroups = async () => {
    const res = await fetch("/api/email-groups");
    if (res.ok) {
      const data = await res.json();
      setGroups(data);
    }
    setLoading(false);
  };

  const handleSend = async () => {
    if (!selectedGroupId || !subject || !body) {
      setError("All fields required");
      return;
    }
    const res = await fetch("/api/email-campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, groupId: selectedGroupId, sendNow: true }),
    });
    if (res.ok) {
      router.push("/dashboard"); // Or to campaigns list
    } else {
      setError("Failed to send");
    }
  };

  if (loading) return <Typography>Loading...</Typography>;

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", mt: 4 }}>
      <Typography variant="h4" gutterBottom>
        Compose Email Campaign
      </Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Select fullWidth value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value as string)} displayEmpty sx={{ mb: 2 }}>
        <MenuItem value="" disabled>
          Select Email Group
        </MenuItem>
        {groups.map((group: any) => (
          <MenuItem key={group.id} value={group.id}>
            {group.name}
          </MenuItem>
        ))}
      </Select>
      <TextField fullWidth label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} sx={{ mb: 2 }} />
      <TextField fullWidth label="Body" multiline rows={6} value={body} onChange={(e) => setBody(e.target.value)} sx={{ mb: 2 }} />
      <Button variant="contained" onClick={handleSend}>
        Send Campaign
      </Button>
    </Box>
  );
}
