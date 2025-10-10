"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Box, Paper, Typography, TextField, Button, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, CircularProgress, Divider, Chip } from "@mui/material";
import { ArrowBack, Send } from "@mui/icons-material";
import { format } from "date-fns";

interface Game {
  id: string;
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  homeTeam: {
    name: string;
    level: string;
    sport: {
      name: string;
    };
  };
  opponent?: {
    name: string;
  };
  venue?: {
    name: string;
  };
  notes?: string;
}

const RECIPIENT_CATEGORIES = [
  { value: "parents", label: "Parents/Guardians" },
  { value: "opponent", label: "Opponent Athletic Directors" },
  { value: "assigners", label: "Officials/Assigners" },
  { value: "coaches", label: "Coaches" },
  { value: "staff", label: "Staff Members" },
  { value: "custom", label: "Custom Recipients" },
];

export default function ComposeEmailPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Game[]>([]);
  const [recipientCategory, setRecipientCategory] = useState("parents");
  const [customRecipients, setCustomRecipients] = useState("");
  const [subject, setSubject] = useState("Game Schedule Confirmation");
  const [additionalMessage, setAdditionalMessage] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Load selected games from sessionStorage
    const storedGames = sessionStorage.getItem("selectedGames");
    if (storedGames) {
      const games = JSON.parse(storedGames);
      setSelectedGames(games);

      // Generate default subject based on games
      if (games.length === 1) {
        setSubject(`Game Confirmation: ${games[0].homeTeam.sport.name} vs ${games[0].opponent?.name || "TBD"}`);
      } else {
        setSubject(`Game Schedule Confirmation - ${games.length} Games`);
      }
    }
  }, [mounted]);

  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const res = await fetch("/api/email/send-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to send email");
      }

      return res.json();
    },
    onSuccess: () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("selectedGames");
      }
      router.push("/dashboard/games");
    },
  });

  const formatGameDate = (dateString: string) => {
    if (!mounted) return dateString;
    try {
      return format(new Date(dateString), "MMM d, yyyy");
    } catch (error) {
      return dateString;
    }
  };

  const formatFullDate = (dateString: string) => {
    if (!mounted) return dateString;
    try {
      return format(new Date(dateString), "EEEE, MMMM d, yyyy");
    } catch (error) {
      return dateString;
    }
  };

  const handleSendEmail = () => {
    // Parse recipients based on category
    let recipients: string[] = [];

    if (recipientCategory === "custom") {
      recipients = customRecipients
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
    } else {
      // In a real app, you'd fetch these from your database based on category
      recipients = [`${recipientCategory}@example.com`];
    }

    if (recipients.length === 0) {
      alert("Please enter at least one recipient email address");
      return;
    }

    const emailData = {
      to: recipients,
      subject,
      recipientCategory,
      games: selectedGames,
      additionalMessage,
    };

    sendEmailMutation.mutate(emailData);
  };

  const generateEmailPreview = () => {
    if (!mounted) return "Loading preview...";

    let preview = "";

    if (additionalMessage) {
      preview += `${additionalMessage}\n\n`;
    }

    preview += "Game Schedule Details:\n\n";

    selectedGames.forEach((game, index) => {
      preview += `Game ${index + 1}:\n`;
      preview += `Date: ${formatFullDate(game.date)}\n`;
      preview += `Time: ${game.time || "TBD"}\n`;
      preview += `Sport: ${game.homeTeam.sport.name} (${game.homeTeam.level})\n`;
      preview += `Opponent: ${game.opponent?.name || "TBD"}\n`;
      preview += `Location: ${game.isHome ? "Home" : game.venue?.name || "TBD"}\n`;
      preview += `Status: ${game.status}\n`;
      if (game.notes) {
        preview += `Notes: ${game.notes}\n`;
      }
      preview += "\n";
    });

    return preview;
  };

  if (!mounted) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </Box>
    );
  }

  if (selectedGames.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          No games selected
        </Typography>
        <Button variant="contained" startIcon={<ArrowBack />} onClick={() => router.push("/dashboard/games")}>
          Back to Games
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: "flex", alignItems: "center", gap: 2 }}>
        <Button variant="outlined" startIcon={<ArrowBack />} onClick={() => router.back()} sx={{ textTransform: "none" }}>
          Back
        </Button>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Compose Email
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Send game schedule to selected recipients
          </Typography>
        </Box>
      </Box>

      <Stack spacing={3}>
        {/* Selected Games Summary */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Selected Games ({selectedGames.length})
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "#f8fafc" }}>
                  <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Sport</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Level</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Opponent</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedGames.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell>{formatGameDate(game.date)}</TableCell>
                    <TableCell>{game.homeTeam.sport.name}</TableCell>
                    <TableCell>{game.homeTeam.level}</TableCell>
                    <TableCell>{game.opponent?.name || "TBD"}</TableCell>
                    <TableCell>{game.isHome ? "Home" : game.venue?.name || "TBD"}</TableCell>
                    <TableCell>
                      <Chip label={game.status} size="small" color={game.status === "CONFIRMED" ? "success" : "warning"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Email Composition */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
            Email Details
          </Typography>

          <Stack spacing={3}>
            {/* Recipient Category */}
            <TextField select label="Recipient Category" value={recipientCategory} onChange={(e) => setRecipientCategory(e.target.value)} fullWidth helperText="Select who should receive this email">
              {RECIPIENT_CATEGORIES.map((category) => (
                <MenuItem key={category.value} value={category.value}>
                  {category.label}
                </MenuItem>
              ))}
            </TextField>

            {/* Custom Recipients */}
            {recipientCategory === "custom" && (
              <TextField
                label="Email Addresses"
                value={customRecipients}
                onChange={(e) => setCustomRecipients(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="email1@example.com, email2@example.com"
                helperText="Enter email addresses separated by commas"
              />
            )}

            {/* Subject */}
            <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth required />

            {/* Additional Message */}
            <TextField
              label="Additional Message (Optional)"
              value={additionalMessage}
              onChange={(e) => setAdditionalMessage(e.target.value)}
              fullWidth
              multiline
              rows={4}
              placeholder="Add any additional information or instructions..."
              helperText="This message will appear at the top of the email"
            />
          </Stack>
        </Paper>

        {/* Email Preview */}
        <Paper sx={{ p: 3, bgcolor: "#f8fafc" }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Email Preview
          </Typography>
          <Box
            sx={{
              p: 2,
              bgcolor: "white",
              borderRadius: 1,
              border: "1px solid",
              borderColor: "divider",
              fontFamily: "monospace",
              fontSize: 13,
              whiteSpace: "pre-wrap",
              maxHeight: 400,
              overflow: "auto",
            }}
          >
            {generateEmailPreview()}
          </Box>
        </Paper>

        {/* Error Display */}
        {sendEmailMutation.isError && <Alert severity="error">{sendEmailMutation.error?.message || "Failed to send email. Please try again."}</Alert>}

        {/* Action Buttons */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
          <Button variant="outlined" onClick={() => router.back()} disabled={sendEmailMutation.isPending}>
            Cancel
          </Button>
          <Button variant="contained" startIcon={sendEmailMutation.isPending ? <CircularProgress size={20} /> : <Send />} onClick={handleSendEmail} disabled={sendEmailMutation.isPending || !subject}>
            {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
