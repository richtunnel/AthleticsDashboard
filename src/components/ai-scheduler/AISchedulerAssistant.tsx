"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
} from "@mui/material";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import SendIcon from "@mui/icons-material/Send";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import { format, parseISO } from "date-fns";

interface SchedulingSuggestion {
  suggestedDate: string;
  suggestedTime: string;
  reason: string;
  conflicts: string[];
  alternativeDates: Array<{
    date: string;
    time: string;
    reason: string;
  }>;
}

export function AISchedulerAssistant() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"input" | "suggestion" | "email">("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [opponentName, setOpponentName] = useState("");
  const [sport, setSport] = useState("");
  const [teamLevel, setTeamLevel] = useState("");
  const [homeOrAway, setHomeOrAway] = useState<"home" | "away">("home");

  // Suggestion result
  const [suggestion, setSuggestion] = useState<SchedulingSuggestion | null>(null);

  // Email result
  const [generatedEmail, setGeneratedEmail] = useState<{ subject: string; body: string } | null>(null);

  const handleOpen = () => {
    setOpen(true);
    setStep("input");
    setError(null);
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form
    setOpponentName("");
    setSport("");
    setTeamLevel("");
    setHomeOrAway("home");
    setSuggestion(null);
    setGeneratedEmail(null);
    setStep("input");
  };

  const handleGetSuggestion = async () => {
    if (!opponentName || !sport || !teamLevel) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-scheduler/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          opponentName,
          sport,
          teamLevel,
          homeOrAway,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to get suggestion");
      }

      setSuggestion(data.suggestion);
      setStep("suggestion");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get suggestion");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!suggestion) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/ai-scheduler/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestion,
          recipientInfo: {
            schoolName: opponentName,
            sport,
            teamLevel,
            homeOrAway,
          },
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to generate email");
      }

      setGeneratedEmail(data.email);
      setStep("email");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate email");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyEmail = () => {
    if (generatedEmail) {
      const emailText = `Subject: ${generatedEmail.subject}\n\n${generatedEmail.body}`;
      navigator.clipboard.writeText(emailText);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        color="primary"
        startIcon={<SmartToyIcon />}
        onClick={handleOpen}
        sx={{ borderRadius: 2 }}
      >
        AI Scheduler Assistant
      </Button>

      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <SmartToyIcon />
            <Typography variant="h6">AI Scheduler Assistant</Typography>
          </Box>
        </DialogTitle>

        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {step === "input" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Tell me about the game you want to schedule, and I'll find the best available date and time.
              </Typography>

              <TextField
                label="Opponent School Name"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                fullWidth
                required
              />

              <FormControl fullWidth required>
                <InputLabel>Sport</InputLabel>
                <Select value={sport} onChange={(e) => setSport(e.target.value)} label="Sport">
                  <MenuItem value="Football">Football</MenuItem>
                  <MenuItem value="Basketball">Basketball</MenuItem>
                  <MenuItem value="Baseball">Baseball</MenuItem>
                  <MenuItem value="Softball">Softball</MenuItem>
                  <MenuItem value="Soccer">Soccer</MenuItem>
                  <MenuItem value="Volleyball">Volleyball</MenuItem>
                  <MenuItem value="Wrestling">Wrestling</MenuItem>
                  <MenuItem value="Track & Field">Track & Field</MenuItem>
                  <MenuItem value="Cross Country">Cross Country</MenuItem>
                  <MenuItem value="Swimming">Swimming</MenuItem>
                  <MenuItem value="Tennis">Tennis</MenuItem>
                  <MenuItem value="Golf">Golf</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Team Level</InputLabel>
                <Select value={teamLevel} onChange={(e) => setTeamLevel(e.target.value)} label="Team Level">
                  <MenuItem value="VARSITY">Varsity</MenuItem>
                  <MenuItem value="JV">JV</MenuItem>
                  <MenuItem value="FRESHMAN">Freshman</MenuItem>
                  <MenuItem value="MIDDLE_SCHOOL">Middle School</MenuItem>
                  <MenuItem value="YOUTH">Youth</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth required>
                <InputLabel>Game Type</InputLabel>
                <Select value={homeOrAway} onChange={(e) => setHomeOrAway(e.target.value as "home" | "away")} label="Game Type">
                  <MenuItem value="home">Home Game</MenuItem>
                  <MenuItem value="away">Away Game</MenuItem>
                </Select>
              </FormControl>
            </Box>
          )}

          {step === "suggestion" && suggestion && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <Alert severity="success" icon={<CalendarTodayIcon />}>
                <Typography variant="subtitle1" fontWeight={600}>
                  Recommended Schedule
                </Typography>
              </Alert>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {format(parseISO(suggestion.suggestedDate), "EEEE, MMMM d, yyyy")}
                  </Typography>
                  <Typography variant="h5" color="primary" gutterBottom>
                    {suggestion.suggestedTime}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {suggestion.reason}
                  </Typography>
                </CardContent>
              </Card>

              {suggestion.conflicts.length > 0 && (
                <Alert severity="warning">
                  <Typography variant="subtitle2" gutterBottom>
                    Potential Concerns:
                  </Typography>
                  <List dense>
                    {suggestion.conflicts.map((conflict, idx) => (
                      <ListItem key={idx} disableGutters>
                        <ListItemText primary={conflict} />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}

              {suggestion.alternativeDates.length > 0 && (
                <>
                  <Divider />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Alternative Dates:
                  </Typography>
                  {suggestion.alternativeDates.map((alt, idx) => (
                    <Card key={idx} variant="outlined">
                      <CardContent>
                        <Typography variant="body1" fontWeight={600}>
                          {format(parseISO(alt.date), "EEEE, MMM d")} at {alt.time}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {alt.reason}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </Box>
          )}

          {step === "email" && generatedEmail && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
              <Alert severity="info">
                <Typography variant="body2">
                  AI-generated email is ready! You can copy it and send it to the opponent's athletic director.
                </Typography>
              </Alert>

              <Card variant="outlined">
                <CardContent>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Subject:
                    </Typography>
                    <Tooltip title="Copy email to clipboard">
                      <IconButton onClick={handleCopyEmail} size="small">
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="body1" fontWeight={600} gutterBottom>
                    {generatedEmail.subject}
                  </Typography>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Body:
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
                    {generatedEmail.body}
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>

          {step === "input" && (
            <Button variant="contained" onClick={handleGetSuggestion} disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <SmartToyIcon />}>
              {loading ? "Finding Best Time..." : "Find Available Time"}
            </Button>
          )}

          {step === "suggestion" && (
            <>
              <Button onClick={() => setStep("input")}>Back</Button>
              <Button variant="contained" onClick={handleGenerateEmail} disabled={loading} startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}>
                {loading ? "Generating..." : "Generate Email"}
              </Button>
            </>
          )}

          {step === "email" && (
            <>
              <Button onClick={() => setStep("suggestion")}>Back</Button>
              <Button variant="contained" onClick={handleCopyEmail} startIcon={<ContentCopyIcon />}>
                Copy Email
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
