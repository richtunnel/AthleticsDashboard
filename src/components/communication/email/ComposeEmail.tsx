"use client";

import { useNotifications } from "@/contexts/NotificationContext";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  CircularProgress,
  Chip,
  useMediaQuery,
  Checkbox,
  useTheme,
} from "@mui/material";
import { ArrowBack, Send } from "@mui/icons-material";
import { fetchEmailGroups } from "@/lib/api/emailGroups";
import type { EmailGroup } from "./types";
import {
  Game,
  CustomColumn,
  TablePreferencesData,
  EmailGroupCategory,
  STATIC_RECIPIENT_CATEGORIES,
  getDisplayColumns,
  getColumnLabel,
  getCellValue,
  filterGamesBySchools,
  getAllSchoolNamesFromGames,
  getGameCountForSchool,
  formatGameDate,
  EmailPreviewBox,
  buildEmailPreviewHtml,
} from "./EmailPreview";
import styles from "@/styles/email.compose.module.css";

export default function ComposeEmailPage() {
  const router = useRouter();
  const { addNotification } = useNotifications();
  const theme = useTheme();
  const isWideScreen = useMediaQuery("(min-width:1260px)");

  // State
  const [mounted, setMounted] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [recipientCategory, setRecipientCategory] = useState("");
  const [customRecipients, setCustomRecipients] = useState("");
  const [subject, setSubject] = useState("");
  const [additionalMessage, setAdditionalMessage] = useState("");
  const [selectedSchoolNames, setSelectedSchoolNames] = useState<string[]>([]);
  const [hasFailedDraft, setHasFailedDraft] = useState(false);

  // Queries
  const { data: emailGroups = [] } = useQuery<EmailGroup[], Error>({
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

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const res = await fetch("/api/user/profile");
      if (!res.ok) return null;
      return res.json();
    },
  });

  const { data: customColumnsResponse } = useQuery({
    queryKey: ["customColumns"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/custom-columns");
      if (!res.ok) throw new Error("Failed to fetch custom columns");
      return res.json();
    },
  });

  const { data: tablePreferencesResponse } = useQuery({
    queryKey: ["tablePreferences", "games"],
    queryFn: async () => {
      const res = await fetch("/api/user/table-preferences?table=games");
      if (!res.ok) throw new Error("Failed to fetch table preferences");
      return res.json();
    },
  });

  // Memoized values
  const customColumns = useMemo<CustomColumn[]>(() => (customColumnsResponse?.data || []) as CustomColumn[], [customColumnsResponse?.data]);
  const tablePreferences = useMemo<TablePreferencesData | null>(() => (tablePreferencesResponse?.data as TablePreferencesData | null) ?? null, [tablePreferencesResponse?.data]);
  const visibleColumnIds = useMemo(() => getDisplayColumns(tablePreferences, customColumns), [tablePreferences, customColumns]);
  const columnMapping = useMemo(() => tablePreferences?.columnMapping as Record<string, string> | undefined, [tablePreferences]);

  const recipientCategories = useMemo<EmailGroupCategory[]>(() => {
    const emailGroupCategories = emailGroups.map((group) => ({
      value: `emailGroup:${group.id}`,
      label: `${group.name} (${group._count.emails} emails)`,
      groupId: group.id,
      isEmailGroup: true,
    }));

    return [...STATIC_RECIPIENT_CATEGORIES, ...emailGroupCategories];
  }, [emailGroups]);

  const getAllSchoolNames = useMemo(() => getAllSchoolNamesFromGames(allGames, visibleColumnIds, columnMapping, customColumns), [allGames, visibleColumnIds, columnMapping, customColumns]);

  // Use buildEmailPreviewHtml to generate HTML string
  const emailPreviewHtml = useMemo(() => {
    if (!mounted) return "<p>Loading preview...</p>";

    return buildEmailPreviewHtml({
      mounted,
      theme,
      additionalMessage,
      visibleColumnIds,
      columnMapping,
      customColumns,
      selectedGames,
      emailSignature,
    });
  }, [mounted, theme, additionalMessage, visibleColumnIds, columnMapping, customColumns, selectedGames, emailSignature]);

  // Mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: Record<string, unknown>) => {
      const res = await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailData),
      });

      if (!res.ok) {
        const error = await res.json();

        // Save draft on failure
        const emailDraft = {
          subject,
          additionalMessage,
          recipientCategory,
          selectedGames,
          selectedSchoolNames,
          customRecipients,
          timestamp: Date.now(),
        };

        if (typeof window !== "undefined") {
          try {
            sessionStorage.setItem("failedEmailDraft", JSON.stringify(emailDraft));
          } catch (e) {
            console.warn("Failed to save draft to sessionStorage:", e);
          }
        }

        throw new Error(error.error || "Failed to send email");
      }

      return res.json();
    },
    onSuccess: () => {
      addNotification("Email sent successfully!", "success");
      if (typeof window !== "undefined") {
        try {
          sessionStorage.removeItem("selectedGames");
          sessionStorage.removeItem("gamesOpponentFilter");
          sessionStorage.removeItem("failedEmailDraft");
        } catch (e) {
          console.warn("Failed to clear sessionStorage:", e);
        }
      }
      router.push("/dashboard/email-logs");
    },
    onError: (error: Error) => {
      if (!error.message.includes("Failed to send email")) {
        addNotification(`Failed to send email: ${error.message}`, "error");
      }
      router.push("/dashboard/email-logs");
    },
  });

  // Effects
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    try {
      const storedGames = sessionStorage.getItem("selectedGames");
      const storedOpponentFilter = sessionStorage.getItem("gamesOpponentFilter");
      const storedEmailDraft = sessionStorage.getItem("emailDraft");
      const failedEmailDraft = sessionStorage.getItem("failedEmailDraft");

      if (storedGames) {
        const games: Game[] = JSON.parse(storedGames);
        setAllGames(games);
        setSelectedGames(games);

        // Handle opponent filter
        if (storedOpponentFilter && storedOpponentFilter !== "null") {
          try {
            const opponentFilter = JSON.parse(storedOpponentFilter);
            if (opponentFilter?.type === "values" && opponentFilter?.values?.length > 0) {
              setSelectedSchoolNames(opponentFilter.values);
              const filteredGames = filterGamesBySchools(games, opponentFilter.values, visibleColumnIds, columnMapping, customColumns);
              setSelectedGames(filteredGames);
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Handle email draft
        if (storedEmailDraft) {
          try {
            const draft = JSON.parse(storedEmailDraft);
            if (draft.subject) setSubject(draft.subject);
            if (draft.additionalMessage) setAdditionalMessage(draft.additionalMessage);
            if (draft.recipientCategory) setRecipientCategory(draft.recipientCategory);
            if (draft.selectedSchoolNames && Array.isArray(draft.selectedSchoolNames)) {
              setSelectedSchoolNames(draft.selectedSchoolNames);
            }
            if (draft.customRecipients) {
              setCustomRecipients(draft.customRecipients);
            }
            sessionStorage.removeItem("emailDraft");
          } catch {
            // Ignore parse errors
          }
        } else if (failedEmailDraft) {
          // Handle failed draft
          try {
            const draft = JSON.parse(failedEmailDraft);
            const isRecent = Date.now() - (draft.timestamp || 0) < 24 * 60 * 60 * 1000;

            if (isRecent) {
              if (draft.subject) setSubject(draft.subject);
              if (draft.additionalMessage !== undefined) setAdditionalMessage(draft.additionalMessage);
              if (draft.recipientCategory) setRecipientCategory(draft.recipientCategory);
              if (draft.selectedSchoolNames && Array.isArray(draft.selectedSchoolNames)) {
                setSelectedSchoolNames(draft.selectedSchoolNames);
              }
              if (draft.customRecipients) setCustomRecipients(draft.customRecipients);
              setHasFailedDraft(true);
            } else {
              sessionStorage.removeItem("failedEmailDraft");
            }
          } catch {
            // Ignore parse errors
          }
        } else if (games.length > 0 && !subject && userProfile) {
          // Generate default subject only if no draft and profile is loaded
          const schoolName = userProfile?.schoolName || "School";
          setSubject(`${schoolName} Games Confirmation`);
        }
      }
    } catch (e) {
      console.error("Error loading stored data:", e);
    }
  }, [mounted, visibleColumnIds, columnMapping, customColumns, subject, userProfile]);

  // Callbacks
  const handleRestoreFailedDraft = useCallback(() => {
    try {
      const failedEmailDraft = sessionStorage.getItem("failedEmailDraft");
      if (failedEmailDraft) {
        const draft = JSON.parse(failedEmailDraft);
        if (draft.subject) setSubject(draft.subject);
        if (draft.additionalMessage !== undefined) setAdditionalMessage(draft.additionalMessage);
        if (draft.recipientCategory) setRecipientCategory(draft.recipientCategory);
        if (draft.selectedSchoolNames) setSelectedSchoolNames(draft.selectedSchoolNames);
        if (draft.customRecipients) setCustomRecipients(draft.customRecipients);
        setHasFailedDraft(false);
        sessionStorage.removeItem("failedEmailDraft");
        addNotification("Draft restored successfully!", "success");
      }
    } catch {
      // Ignore parse errors
    }
  }, [addNotification]);

  const handleSchoolFilterChange = useCallback(
    (selectedSchools: string[]) => {
      setSelectedSchoolNames(selectedSchools);
      const filteredGames = filterGamesBySchools(allGames, selectedSchools, visibleColumnIds, columnMapping, customColumns);
      setSelectedGames(filteredGames);
    },
    [allGames, visibleColumnIds, columnMapping, customColumns],
  );

  // Loading state
  if (!mounted) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "400px" }}>
        <CircularProgress />
      </Box>
    );
  }

  // No games state
  if (allGames.length === 0) {
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
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Compose Email
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Send game schedule to selected recipients
          </Typography>
        </Box>
        {hasFailedDraft && (
          <Button variant="outlined" color="warning" onClick={handleRestoreFailedDraft} sx={{ textTransform: "none" }}>
            Restore Draft
          </Button>
        )}
      </Box>

      <Stack spacing={3}>
        {/* Two-column layout */}
        <Box sx={{ display: "flex", flexDirection: isWideScreen ? "row" : "column", gap: 3, width: "100%" }}>
          {/* Selected Games — capped at 65% so Email Details always has room */}
          <Box sx={{ flex: isWideScreen ? "0 0 65%" : "none", maxWidth: isWideScreen ? "65%" : "100%", minWidth: 0 }}>
            <Paper sx={{ p: 3, height: "100%", bgcolor: "background.paper" }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Selected Games ({selectedGames.length}/{allGames.length})
                {selectedSchoolNames.length > 0 && (
                  <Chip label={`Filtered: ${selectedSchoolNames.length} school${selectedSchoolNames.length === 1 ? "" : "s"}`} size="small" color="primary" sx={{ ml: 1 }} />
                )}
              </Typography>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ fontSize: "0.85rem" }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.selected" }}>
                      {visibleColumnIds.map((columnId) => {
                        if (columnId === "actions") return null;
                        return (
                          <TableCell key={columnId} sx={{ fontWeight: 600, fontSize: "0.85rem" }}>
                            {getColumnLabel(columnId, customColumns)}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedGames.map((game) => (
                      <TableRow key={game.id}>
                        {visibleColumnIds.map((columnId) => {
                          if (columnId === "actions") return null;

                          const cellValue = getCellValue(game, columnId, columnMapping);

                          if (columnId === "status") {
                            return (
                              <TableCell key={columnId} sx={{ fontSize: "0.85rem" }}>
                                <Chip label={game.status} size="small" color={game.status === "CONFIRMED" ? "success" : "warning"} />
                              </TableCell>
                            );
                          }

                          if (columnId === "date" || (columnId.startsWith("imported:") && columnMapping?.[columnId.split(":")[1]] === "date")) {
                            return (
                              <TableCell key={columnId} sx={{ fontSize: "0.85rem" }}>
                                {formatGameDate(cellValue)}
                              </TableCell>
                            );
                          }

                          return (
                            <TableCell key={columnId} sx={{ fontSize: "0.85rem" }}>
                              {cellValue}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          {/* Email Composition — takes all remaining space (~35%) */}
          <Box sx={{ flex: "1 1 0%", minWidth: isWideScreen ? 280 : "100%" }}>
            <Paper sx={{ p: 3, height: "100%", bgcolor: "background.paper" }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Email Details
              </Typography>

              <Stack spacing={3}>
                <TextField
                  className={styles.ReceiptSelectField}
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

                {/* School Filter */}
                {getAllSchoolNames.length > 0 && (
                  <Box
                    sx={{
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 2,
                      bgcolor: "action.hover",
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                      Filter by School/Opponent
                    </Typography>

                    <TextField
                      select
                      label="Select Schools/Opponents"
                      value={selectedSchoolNames}
                      onChange={(e) => {
                        const value = e.target.value;
                        handleSchoolFilterChange(typeof value === "string" ? [value] : value);
                      }}
                      fullWidth
                      size="small"
                      SelectProps={{
                        multiple: true,
                        renderValue: (selected) => {
                          const selectedArray = selected as string[];
                          if (selectedArray.length === 0) return "All schools/opponents";
                          if (selectedArray.length === 1) return selectedArray[0];
                          return `${selectedArray.length} schools selected`;
                        },
                      }}
                      helperText={`Select which schools/opponents to include (${getAllSchoolNames.length} available)`}
                    >
                      {getAllSchoolNames.map((schoolName) => {
                        const gameCount = getGameCountForSchool(schoolName, allGames, visibleColumnIds, columnMapping, customColumns);

                        return (
                          <MenuItem key={schoolName} value={schoolName}>
                            <Checkbox checked={selectedSchoolNames.includes(schoolName)} />
                            {schoolName} ({gameCount} {gameCount === 1 ? "game" : "games"})
                          </MenuItem>
                        );
                      })}
                    </TextField>

                    {/* Filter Summary */}
                    {selectedSchoolNames.length > 0 && (
                      <Box
                        sx={{
                          display: "flex",
                          gap: 1,
                          flexWrap: "wrap",
                          alignItems: "center",
                          mt: 2,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Filtered by:
                        </Typography>
                        {selectedSchoolNames.map((schoolName) => (
                          <Chip
                            key={schoolName}
                            label={schoolName}
                            size="small"
                            onDelete={() => {
                              const newSchools = selectedSchoolNames.filter((name) => name !== schoolName);
                              handleSchoolFilterChange(newSchools);
                            }}
                            color="primary"
                            variant="outlined"
                          />
                        ))}
                        <Button size="small" onClick={() => handleSchoolFilterChange([])} sx={{ ml: 1 }}>
                          Clear All
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}

                <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth required error={!subject} helperText={!subject ? "Subject is required" : ""} />

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

        {/* Preview */}
        <Paper sx={{ p: 3, bgcolor: "background.paper" }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Email Preview
          </Typography>
          <EmailPreviewBox html={emailPreviewHtml} />
        </Paper>

        {/* Error Display */}
        {sendEmailMutation.isError && <Alert severity="error">{sendEmailMutation.error?.message || "Failed to send email. Your draft has been saved."}</Alert>}

        {/* Action Buttons */}
        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 2 }}>
          <Button variant="outlined" onClick={() => router.back()} disabled={sendEmailMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={sendEmailMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <Send />}
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
                visibleColumnIds: visibleColumnIds.filter((id) => id !== "actions"),
                selectedSchoolNames,
                customRecipients:
                  recipientCategory === "custom"
                    ? customRecipients
                        .split(",")
                        .map((e) => e.trim())
                        .filter(Boolean)
                    : [],
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
