"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Box, Typography, Card, CardContent, Grid, TextField, Button, Paper, Avatar, CircularProgress, Alert, Chip } from "@mui/material";
import { Send, Person, Email } from "@mui/icons-material";

interface LinkedSchool {
  id: string;
  schoolName: string;
  athleticDirectorId: string;
  athleticDirectorName: string;
  sportName: string;
  sportLevel: string;
}

async function fetchLinkedSchools(): Promise<{ schools: LinkedSchool[] }> {
  const res = await fetch("/api/parent/linked-schools");
  if (!res.ok) throw new Error("Failed to fetch linked schools");
  return res.json();
}

export default function ParentChatPage() {
  const [selectedSchool, setSelectedSchool] = useState<LinkedSchool | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["linkedSchools"],
    queryFn: fetchLinkedSchools,
  });

  const handleSendMessage = async () => {
    if (!selectedSchool || !message.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/parent/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleticDirectorId: selectedSchool.athleticDirectorId,
          schoolName: selectedSchool.schoolName,
          sportName: selectedSchool.sportName,
          sportLevel: selectedSchool.sportLevel,
          message: message.trim(),
        }),
      });

      if (res.ok) {
        setSent(true);
        setMessage("");
        setTimeout(() => setSent(false), 3000);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Chat
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Message the athletic director about your child's games
        </Typography>
      </Box>

      {sent && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Message sent successfully!
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* School List */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Your Schools
              </Typography>
              {data?.schools?.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No schools connected yet
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {data?.schools?.map((school) => (
                    <Paper
                      key={school.id}
                      variant="outlined"
                      sx={{
                        p: 2,
                        cursor: "pointer",
                        borderColor: selectedSchool?.id === school.id ? "primary.main" : "divider",
                        bgcolor: selectedSchool?.id === school.id ? "primary.light" + "10" : "transparent",
                        "&:hover": {
                          borderColor: "primary.main",
                        },
                      }}
                      onClick={() => setSelectedSchool(school)}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {school.schoolName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {school.sportName} - {school.sportLevel}
                      </Typography>
                    </Paper>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Message Area */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Send Message
              </Typography>

              {selectedSchool ? (
                <>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                    <Avatar sx={{ bgcolor: "primary.main" }}>
                      <Person />
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        To: {selectedSchool.athleticDirectorName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedSchool.schoolName} - {selectedSchool.sportName}
                      </Typography>
                    </Box>
                  </Box>

                  <TextField fullWidth multiline rows={6} placeholder="Type your message here..." value={message} onChange={(e) => setMessage(e.target.value)} sx={{ mb: 2 }} />

                  <Button variant="contained" endIcon={sending ? <CircularProgress size={20} color="inherit" /> : <Send />} onClick={handleSendMessage} disabled={!message.trim() || sending}>
                    {sending ? "Sending..." : "Send Message"}
                  </Button>
                </>
              ) : (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    Select a school from the list to send a message
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
