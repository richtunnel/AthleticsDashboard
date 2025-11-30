"use client";
import { useNotifications } from "@/contexts/NotificationContext";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Box, Paper, Typography, TextField, Button, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert, CircularProgress, Divider, Chip, useMediaQuery } from "@mui/material";
import { ArrowBack, Send } from "@mui/icons-material";
import { format } from "date-fns";
import { fetchEmailGroups } from "@/lib/api/emailGroups";
import type { EmailGroup } from "./types";
import { formatLevelDisplay } from "@/lib/utils/formatters";
import { buildEmailSignatureHTML } from "@/lib/utils/email-signature";

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
    id?: string;
    name: string;
  };
  opponentId?: string;
  venue?: {
    name: string;
  };
  notes?: string;
}

const STATIC_RECIPIENT_CATEGORIES = [
  { value: "custom", label: "Custom Recipients" },
  // { value: "opponent", label: "Opponent Athletic Directors" },
  // { value: "assigners", label: "Officials/Assigners" },
  // { value: "coaches", label: "Coaches" },
  // { value: "staff", label: "Staff Members" },
];

export default function ComposeEmailPage() {
  const router = useRouter();
  const { addNotification } = useNotifications();
  const isWideScreen = useMediaQuery('(min-width:1260px)');
  const [mounted, setMounted] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  // Always show all important columns in the email preview table, regardless of user's column visibility preferences in GamesTable
  const visibleColumnIds = useMemo(() => ["date", "sport", "level", "opponent", "location", "status", "time", "notes"], []);
  const [recipientCategory, setRecipientCategory] = useState("");
  const [customRecipients, setCustomRecipients] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [additionalMessage, setAdditionalMessage] = useState("");
  const [selectedOpponentId, setSelectedOpponentId] = useState<string>("all");
  const [opponentFilterDisabled, setOpponentFilterDisabled] = useState(false);

  const { data: emailGroups = [], isLoading: emailGroupsLoading } = useQuery<EmailGroup[], Error>({
    queryKey: ["email-groups"],
    queryFn: fetchEmailGroups,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: emailSignature } = useQuery({
    queryKey: ["email-signature"],
    queryFn: async () => {
      const res = await fetch("/api/user/email-signature");
      if (!res.ok) return null;
      const data = await res.json();
      return data.data || null;
    },
  });

  const recipientCategories = useMemo(() => {
    const emailGroupCategories = emailGroups.map((group) => ({
      value: `emailGroup:${group.id}`,
      label: `${group.name} (${group._count.emails} emails)`,
      groupId: group.id,
      isEmailGroup: true,
    }));

    return [...STATIC_RECIPIENT_CATEGORIES, ...emailGroupCategories];
  }, [emailGroups]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Load selected games from sessionStorage
    const storedGames = sessionStorage.getItem("selectedGames");
    const storedOpponentFilter = sessionStorage.getItem("gamesOpponentFilter");
    const storedEmailDraft = sessionStorage.getItem("emailDraft");

    if (storedGames) {
      const games = JSON.parse(storedGames);
      setAllGames(games);
      setSelectedGames(games);

      // Check if there was an opponent filter applied in the games table
      if (storedOpponentFilter && storedOpponentFilter !== "null") {
        try {
          const opponentFilter = JSON.parse(storedOpponentFilter);
          // If filter type is "values" and only one opponent is selected, pre-fill and disable
          if (opponentFilter?.type === "values" && opponentFilter?.values?.length === 1) {
            const opponentName = opponentFilter.values[0];
            // Find the opponent ID from the games
            const gameWithOpponent = games.find((g: Game) => g.opponent?.name === opponentName);
            if (gameWithOpponent && (gameWithOpponent.opponentId || gameWithOpponent.opponent?.id)) {
              const opponentId = gameWithOpponent.opponentId || gameWithOpponent.opponent?.id || "";
              setSelectedOpponentId(opponentId);
              setOpponentFilterDisabled(true);
              // Filter games to this opponent
              const filteredGames = games.filter((g: Game) => {
                const gameOpponentId = g.opponentId || g.opponent?.id;
                return gameOpponentId === opponentId;
              });
              setSelectedGames(filteredGames);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      // Check if there's a draft from email logs (re-open & edit)
      if (storedEmailDraft) {
        try {
          const draft = JSON.parse(storedEmailDraft);
          if (draft.subject) setSubject(draft.subject);
          if (draft.additionalMessage) setAdditionalMessage(draft.additionalMessage);
          if (draft.recipientCategory) setRecipientCategory(draft.recipientCategory);
          // Clear the draft after loading
          sessionStorage.removeItem("emailDraft");
        } catch (e) {
          // Ignore parse errors
        }
      } else {
        // Generate default subject based on games only if no draft
        if (games.length === 1) {
          setSubject(`Game Confirmation: ${games[0].homeTeam.sport.name} vs ${games[0].opponent?.name || "TBD"}`);
        } else {
          setSubject(`Game Schedule Confirmation - ${games.length} Games`);
        }
      }
    }
  }, [mounted]);

  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const res = await fetch("/api/email/send", {
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
      addNotification("Email sent successfully!", "success");
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("selectedGames");
        sessionStorage.removeItem("gamesOpponentFilter");
      }
      router.push("/dashboard/email-logs");
    },
    onError: (error: Error) => {
      addNotification(`Failed to send email: ${error.message}`, "error");
    },
  });

  const formatGameDate = (dateString: string) => {
    if (!mounted) return dateString;
    try {
      // Parse the date as UTC to avoid timezone shifts
      const date = new Date(dateString);
      // Extract the UTC date parts to ensure consistent display
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      // Format using UTC components directly to avoid timezone conversion issues
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[month]} ${day}, ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const formatFullDate = (dateString: string) => {
    if (!mounted) return dateString;
    try {
      // Parse the date as UTC to avoid timezone shifts
      const date = new Date(dateString);
      // Extract the UTC date parts to ensure consistent display
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      // Format using UTC components directly to avoid timezone conversion issues
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const utcDate = new Date(Date.UTC(year, month, day));
      const dayOfWeek = dayNames[utcDate.getUTCDay()];
      return `${dayOfWeek}, ${monthNames[month]} ${day}, ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const handleOpponentChange = (opponentId: string) => {
    setSelectedOpponentId(opponentId);

    if (opponentId === "all") {
      setSelectedGames(allGames);
    } else {
      const filteredGames = allGames.filter((game) => {
        const gameOpponentId = game.opponentId || game.opponent?.id;
        return gameOpponentId === opponentId;
      });
      setSelectedGames(filteredGames);
    }
  };

  const uniqueOpponents = useMemo(() => {
    const opponentMap = new Map<string, { id: string; name: string }>();

    allGames.forEach((game) => {
      const opponentId = game.opponentId || game.opponent?.id;
      const opponentName = game.opponent?.name;

      if (opponentId && opponentName && !opponentMap.has(opponentId)) {
        opponentMap.set(opponentId, { id: opponentId, name: opponentName });
      }
    });

    return Array.from(opponentMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allGames]);

  const escapeHtml = (text: string) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const generateEmailPreview = () => {
    if (!mounted) return "<p>Loading preview...</p>";

    let html = '<div style="font-family: Arial, sans-serif; max-width: 1180px; margin: 0 auto;">';

    // Add heading
    html += '<h2 style="color: #23252a; margin-bottom: 16px;">Game Schedule Confirmation</h2>';

    // Add additional message if present
    if (additionalMessage) {
      html += `<div style="margin-bottom: 24px; padding: 16px; background-color: #f3f4f6; border-left: 4px solid #23252a; border-radius: 4px;">`;
      html += `<p style="margin: 0; white-space: pre-wrap;">${escapeHtml(additionalMessage)}</p>`;
      html += "</div>";
    }

    // Add games table
    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 0.85rem;">';

    // Table header
    html += "<thead>";
    html += '<tr style="background-color: #23252a; color: white;">';
    html += '<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">Date</th>';
    html += '<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">Time</th>';
    html += '<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">Sport</th>';
    html += '<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">Level</th>';
    html += '<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">Opponent</th>';
    html += '<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">Location</th>';
    html += '<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">Status</th>';
    html += "</tr>";
    html += "</thead>";

    // Table body
    html += "<tbody>";
    selectedGames.forEach((game, index) => {
      const bgColor = index % 2 === 0 ? "#ffffff" : "#f9fafb";
      html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e5e7eb;">`;
      html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;">${escapeHtml(formatFullDate(game.date))}</td>`;
      html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;">${escapeHtml(game.time || "TBD")}</td>`;
      html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;">${escapeHtml(game.homeTeam.sport.name)}</td>`;
      html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;">${escapeHtml(formatLevelDisplay(game.homeTeam.level))}</td>`;
      html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;">${escapeHtml(game.opponent?.name || "TBD")}</td>`;
      html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;">${game.isHome ? "<strong>Home</strong>" : escapeHtml(game.venue?.name || "TBD")}</td>`;

      // Status with color
      const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#BEDBFE";
      html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;"><span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(game.status)}</span></td>`;
      html += "</tr>";

      // Add notes row if present
      if (game.notes) {
        html += `<tr style="background-color: ${bgColor};">`;
        html += `<td colspan="7" style="padding: 8px 12px; font-size: 13px; color: #6b7280; font-style: italic; border: 1px solid #e5e7eb;">`;
        html += `<strong>Note:</strong> ${escapeHtml(game.notes)}`;
        html += "</td>";
        html += "</tr>";
      }
    });
    html += "</tbody>";
    html += "</table>";

    // Add footer with contact information
    html += '<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">';
    html += '<p style="color: #6b7280; font-size: 14px; margin: 8px 0;">If you have any questions, please contact the athletic department.</p>';
    html += '<p style="color: #6b7280; font-size: 12px; margin: 8px 0;">This is an automated message from the Athletic Director Dashboard.</p>';
    html += "</div>";

    // Add email signature if present
    if (emailSignature) {
      const signatureHTML = buildEmailSignatureHTML({
        signaturePhone: emailSignature.signaturePhone,
        signatureWebsite: emailSignature.signatureWebsite,
        signatureLogoUrl: emailSignature.signatureLogoUrl,
      });
      if (signatureHTML) {
        html += signatureHTML;
      }
    }

    html += "</div>";

    return html;
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
        {/* Two-column layout for wide screens, stacked for smaller screens */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: isWideScreen ? 'row' : 'column', 
          gap: 3,
          width: '100%'
        }}>
          {/* Selected Games Summary - Left Column */}
          <Box sx={{ flex: isWideScreen ? 1.5 : 'none', width: '100%' }}>
            <Paper sx={{ p: 3, height: "100%" }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Selected Games ({selectedGames.length}){selectedOpponentId !== "all" && opponentFilterDisabled && <Chip label="Filtered by opponent" size="small" color="primary" sx={{ ml: 1 }} />}
              </Typography>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small" sx={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      {visibleColumnIds.includes("date") && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Date</TableCell>}
                      {visibleColumnIds.includes("sport") && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Sport</TableCell>}
                      {visibleColumnIds.includes("level") && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Level</TableCell>}
                      {visibleColumnIds.includes("opponent") && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Opponent</TableCell>}
                      {(visibleColumnIds.includes("location") || visibleColumnIds.includes("isHome")) && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Location</TableCell>}
                      {visibleColumnIds.includes("status") && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Status</TableCell>}
                      {visibleColumnIds.includes("time") && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Time</TableCell>}
                      {visibleColumnIds.includes("notes") && <TableCell sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Notes</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedGames.map((game) => (
                      <TableRow key={game.id}>
                        {visibleColumnIds.includes("date") && <TableCell sx={{ fontSize: '0.85rem' }}>{formatGameDate(game.date)}</TableCell>}
                        {visibleColumnIds.includes("sport") && <TableCell sx={{ fontSize: '0.85rem' }}>{game.homeTeam.sport.name}</TableCell>}
                        {visibleColumnIds.includes("level") && <TableCell sx={{ fontSize: '0.85rem' }}>{formatLevelDisplay(game.homeTeam.level)}</TableCell>}
                        {visibleColumnIds.includes("opponent") && <TableCell sx={{ fontSize: '0.85rem' }}>{game.opponent?.name || "TBD"}</TableCell>}
                        {(visibleColumnIds.includes("location") || visibleColumnIds.includes("isHome")) && <TableCell sx={{ fontSize: '0.85rem' }}>{game.isHome ? "Home" : game.venue?.name || "TBD"}</TableCell>}
                        {visibleColumnIds.includes("status") && (
                          <TableCell sx={{ fontSize: '0.85rem' }}>
                            <Chip label={game.status} size="small" color={game.status === "CONFIRMED" ? "success" : "warning"} />
                          </TableCell>
                        )}
                        {visibleColumnIds.includes("time") && <TableCell sx={{ fontSize: '0.85rem' }}>{game.time || "TBD"}</TableCell>}
                        {visibleColumnIds.includes("notes") && <TableCell sx={{ fontSize: '0.85rem' }}>{game.notes || ""}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {/* Email Composition - Right Column */}
          <Box sx={{ flex: isWideScreen ? 1 : 'none', width: '100%' }}>
            <Paper sx={{ p: 3, height: "100%" }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Email Details
              </Typography>

              <Stack spacing={3}>
                {/* Recipient Category */}
                <TextField 
                  select 
                  label="Recipient Category" 
                  value={recipientCategory} 
                  onChange={(e) => setRecipientCategory(e.target.value)} 
                  fullWidth 
                  required
                  error={!recipientCategory}
                  helperText={!recipientCategory ? "Recipient category is required" : "Select who should receive this email"}
                >
                  {recipientCategories.map((category) => (
                    <MenuItem key={category.value} value={category.value}>
                      {category.label}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Opponent Filter */}
                {uniqueOpponents.length > 0 && (
                  <TextField
                    select
                    label="Filter by Opponent"
                    value={selectedOpponentId}
                    onChange={(e) => handleOpponentChange(e.target.value)}
                    fullWidth
                    disabled={opponentFilterDisabled}
                    helperText={opponentFilterDisabled ? "Opponent filter is already applied from the games table" : "Select a specific opponent to filter which games are included in the email"}
                  >
                    <MenuItem value="all">All Opponents ({allGames.length} games)</MenuItem>
                    {uniqueOpponents.map((opponent) => {
                      const gameCount = allGames.filter((g) => {
                        const gameOpponentId = g.opponentId || g.opponent?.id;
                        return gameOpponentId === opponent.id;
                      }).length;
                      return (
                        <MenuItem key={opponent.id} value={opponent.id}>
                          {opponent.name} ({gameCount} {gameCount === 1 ? "game" : "games"})
                        </MenuItem>
                      );
                    })}
                  </TextField>
                )}

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
                <TextField 
                  label="Subject" 
                  value={subject} 
                  onChange={(e) => setSubject(e.target.value)} 
                  fullWidth 
                  required 
                  error={!subject}
                  helperText={!subject ? "Subject is required" : ""}
                />

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
          </Box>
        </Box>

        {/* Email Preview - Full Width Below */}
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
              maxHeight: 400,
              overflow: "auto",
            }}
            dangerouslySetInnerHTML={{ __html: generateEmailPreview() }}
          />
        </Paper>

        {/* Error Display */}
        {sendEmailMutation.isError && <Alert severity="error">{sendEmailMutation.error?.message || "Failed to send email. Please try again."}</Alert>}

        {/* Action Buttons */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
          <Button variant="outlined" onClick={() => router.back()} disabled={sendEmailMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={sendEmailMutation.isPending ? <CircularProgress size={20} /> : <Send />}
            onClick={() => {
              const gameIds = selectedGames.map((g) => g.id);
              const isEmailGroup = recipientCategory.startsWith("emailGroup:");
              const groupId = isEmailGroup ? recipientCategory.split(":")[1] : undefined;
              const actualCategory = isEmailGroup ? "emailGroup" : recipientCategory;

              sendEmailMutation.mutate({
                gameIds,
                subject,
                additionalMessage,
                recipientCategory: actualCategory,
                groupId,
                to:
                  recipientCategory === "custom"
                    ? customRecipients
                        .split(",")
                        .map((e) => e.trim())
                        .filter(Boolean)
                    : undefined,
              });
            }}
            disabled={sendEmailMutation.isPending || !recipientCategory || !subject || (recipientCategory === "custom" && !customRecipients.trim())}
          >
            {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
          </Button>
        </Box>
      </Stack>
    </Box>
  );
}
