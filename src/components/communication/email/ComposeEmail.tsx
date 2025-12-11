"use client";
import { useNotifications } from "@/contexts/NotificationContext";
import { useState, useEffect, useMemo } from "react";
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
  Divider,
  Chip,
  useMediaQuery,
  Checkbox,
} from "@mui/material";
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
  customFields?: Record<string, any>; // For imported CSV columns
  customData?: Record<string, any>; // For custom columns created via CustomColumnManager
}

interface CustomColumn {
  id: string;
  name: string;
  type: string;
}

interface TablePreferencesData {
  customColumns?: string[];
  columnMapping?: Record<string, string>;
  [key: string]: unknown;
}

const STATIC_RECIPIENT_CATEGORIES = [{ value: "custom", label: "Custom Recipients" }];

<style jsx>{`
  .recipientCategory > label {
    top: -5px;
  }
`}</style>;

// Helper to determine which columns to display based on user's import preferences and custom columns
// CRITICAL FIX: Respect hidden columns from table preferences
const getDisplayColumns = (preferences: TablePreferencesData | null, customColumns: CustomColumn[]): string[] => {
  // Get hidden columns from preferences
  const hiddenColumns = new Set<string>(Array.isArray(preferences?.hidden) ? (preferences.hidden as string[]) : []);

  // Check if user has imported custom columns from CSV
  const importedColumns = preferences?.customColumns as string[] | undefined;
  const columnMapping = preferences?.columnMapping as Record<string, string> | undefined;

  let allColumns: string[];

  if (importedColumns && columnMapping && importedColumns.length > 0) {
    // User imported CSV with custom columns - show imported columns + custom columns
    const importedIds = importedColumns
      .filter((colName) => {
        const mapping = columnMapping[colName];
        return mapping && mapping !== "skip"; // Only include non-skipped columns
      })
      .map((colName) => `imported:${colName}`);

    // Add custom columns
    const customIds = customColumns.map((col) => `custom:${col.id}`);

    allColumns = [...importedIds, ...customIds];
  } else {
    // No imported columns - use default columns + custom columns
    const defaultColumns = ["date", "sport", "level", "opponent", "location", "status", "time", "notes"];
    const customIds = customColumns.map((col) => `custom:${col.id}`);

    allColumns = [...defaultColumns, ...customIds];
  }

  // CRITICAL: Filter out hidden columns before returning
  return allColumns.filter((columnId) => !hiddenColumns.has(columnId));
};

// Helper to get column label
const getColumnLabel = (columnId: string, customColumns: CustomColumn[]): string => {
  // Handle imported columns
  if (columnId.startsWith("imported:")) {
    const columnName = columnId.split(":")[1];
    return columnName; // Use the CSV column name as-is
  }

  // Handle custom columns
  if (columnId.startsWith("custom:")) {
    const customId = columnId.split(":")[1];
    const customColumn = customColumns.find((col) => col.id === customId);
    return customColumn?.name || "Custom Field";
  }

  // Return default labels
  switch (columnId) {
    case "date":
      return "Date";
    case "sport":
      return "Sport";
    case "level":
      return "Level";
    case "opponent":
      return "Opponent";
    case "isHome":
    case "location":
      return "Location";
    case "time":
      return "Time";
    case "status":
      return "Confirmed";
    case "notes":
      return "Notes";
    default:
      return columnId;
  }
};

// Helper to get cell value for a column
const getCellValue = (game: Game, columnId: string, columnMapping?: Record<string, string>): string => {
  // Handle imported columns
  if (columnId.startsWith("imported:")) {
    const columnName = columnId.split(":")[1];

    // CRITICAL FIX: Check if this imported column is mapped to a standard field like "date"
    const mapping = columnMapping?.[columnName];
    if (mapping === "date") {
      // This imported column is mapped to date - return game.date
      return game.date;
    } else if (mapping === "time") {
      // This imported column is mapped to time - return game.time
      return game.time || "TBD";
    }

    // Otherwise, look in customFields for preserved columns
    const customFields = game.customFields || {};
    return customFields[columnName] || "—";
  }

  // Handle custom columns
  if (columnId.startsWith("custom:")) {
    const customId = columnId.split(":")[1];
    const customData = (game.customData as any) || {};
    return customData[customId] || "—";
  }

  // Handle default columns
  switch (columnId) {
    case "date":
      return game.date;
    case "sport":
      return game.homeTeam.sport.name;
    case "level":
      return formatLevelDisplay(game.homeTeam.level);
    case "opponent":
      return game.opponent?.name || "TBD";
    case "isHome":
    case "location":
      return game.isHome ? "Home" : game.venue?.name || "TBD";
    case "time":
      return game.time || "TBD";
    case "status":
      return game.status;
    case "notes":
      return game.notes || "";
    default:
      return "";
  }
};

export default function ComposeEmailPage() {
  const router = useRouter();
  const { addNotification } = useNotifications();
  const isWideScreen = useMediaQuery("(min-width:1260px)");
  const [mounted, setMounted] = useState(false);
  const [selectedGames, setSelectedGames] = useState<Game[]>([]);
  const [allGames, setAllGames] = useState<Game[]>([]);
  const [recipientCategory, setRecipientCategory] = useState("");
  const [customRecipients, setCustomRecipients] = useState("");
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [subject, setSubject] = useState("");
  const [additionalMessage, setAdditionalMessage] = useState("");
  const [selectedSchoolNames, setSelectedSchoolNames] = useState<string[]>([]);

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

  // Fetch custom columns
  const { data: customColumnsResponse } = useQuery({
    queryKey: ["customColumns"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/custom-columns");
      if (!res.ok) throw new Error("Failed to fetch custom columns");
      return res.json();
    },
  });

  const customColumns = useMemo<CustomColumn[]>(() => (customColumnsResponse?.data || []) as CustomColumn[], [customColumnsResponse?.data]);

  // Fetch table preferences to determine which columns to display
  const { data: tablePreferencesResponse } = useQuery({
    queryKey: ["tablePreferences", "games"],
    queryFn: async () => {
      const res = await fetch("/api/user/table-preferences?table=games");
      if (!res.ok) throw new Error("Failed to fetch table preferences");
      return res.json();
    },
  });

  const tablePreferences = useMemo<TablePreferencesData | null>(() => (tablePreferencesResponse?.data as TablePreferencesData | null) ?? null, [tablePreferencesResponse?.data]);

  // Determine visible columns based on user's import preferences and custom columns
  const visibleColumnIds = useMemo(() => getDisplayColumns(tablePreferences, customColumns), [tablePreferences, customColumns]);

  // Extract columnMapping for checking imported column mappings
  const columnMapping = useMemo(() => tablePreferences?.columnMapping as Record<string, string> | undefined, [tablePreferences]);

  const recipientCategories = useMemo(() => {
    const emailGroupCategories = emailGroups.map((group) => ({
      value: `emailGroup:${group.id}`,
      label: `${group.name} (${group._count.emails} emails)`,
      groupId: group.id,
      isEmailGroup: true,
    }));

    return [...STATIC_RECIPIENT_CATEGORIES, ...emailGroupCategories];
  }, [emailGroups]);

  // Get all unique school/opponent names from opponent-related columns
  const getAllSchoolNames = useMemo(() => {
    if (!allGames.length) return [];

    const schoolNamesSet = new Set<string>();

    // Find columns that might contain opponent/school information
    const opponentColumns = visibleColumnIds.filter((columnId) => {
      const label = getColumnLabel(columnId, customColumns).toLowerCase();
      return (
        label.includes("opponent") ||
        label.includes("away") ||
        label.includes("enemy") ||
        label.includes("visiting") ||
        label.includes("visitor") ||
        label.includes("against") ||
        label.includes("vs") ||
        label.includes("versus") ||
        label.includes("school") ||
        label.includes("team")
      );
    });

    // Extract all school names from these columns
    allGames.forEach((game) => {
      opponentColumns.forEach((columnId) => {
        const value = getCellValue(game, columnId, columnMapping);
        if (value && value !== "—" && value !== "TBD" && value !== "Home" && value.trim()) {
          schoolNamesSet.add(value.trim());
        }
      });

      // Also include standard opponent field
      if (game.opponent?.name && game.opponent.name !== "TBD") {
        schoolNamesSet.add(game.opponent.name);
      }
    });

    return Array.from(schoolNamesSet).sort();
  }, [allGames, visibleColumnIds, columnMapping, customColumns]);

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
          // If filter type is "values", pre-fill the school filter
          if (opponentFilter?.type === "values" && opponentFilter?.values?.length > 0) {
            setSelectedSchoolNames(opponentFilter.values);
            // Filter games to these opponents
            const filteredGames = games.filter((game: Game) => {
              // Check if any opponent-related column contains the selected school names
              return opponentFilter.values.some((schoolName: string) => {
                // Check standard opponent field
                if (game.opponent?.name === schoolName) return true;

                // Check other opponent-related columns
                return visibleColumnIds.some((columnId) => {
                  const label = getColumnLabel(columnId, customColumns).toLowerCase();
                  const isOpponentColumn =
                    label.includes("opponent") ||
                    label.includes("away") ||
                    label.includes("enemy") ||
                    label.includes("visiting") ||
                    label.includes("visitor") ||
                    label.includes("against") ||
                    label.includes("vs") ||
                    label.includes("versus") ||
                    label.includes("school") ||
                    label.includes("team");

                  if (isOpponentColumn) {
                    const cellValue = getCellValue(game, columnId, columnMapping);
                    return cellValue === schoolName;
                  }
                  return false;
                });
              });
            });
            setSelectedGames(filteredGames);
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
  }, [mounted, visibleColumnIds, columnMapping, customColumns]);

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
      const date = new Date(dateString);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${monthNames[month]} ${day}, ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const formatFullDate = (dateString: string) => {
    if (!mounted) return dateString;
    try {
      const date = new Date(dateString);
      const year = date.getUTCFullYear();
      const month = date.getUTCMonth();
      const day = date.getUTCDate();
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const utcDate = new Date(Date.UTC(year, month, day));
      const dayOfWeek = dayNames[utcDate.getUTCDay()];
      return `${dayOfWeek}, ${monthNames[month]} ${day}, ${year}`;
    } catch (error) {
      return dateString;
    }
  };

  const handleSchoolFilterChange = (selectedSchools: string[]) => {
    setSelectedSchoolNames(selectedSchools);

    if (selectedSchools.length === 0) {
      setSelectedGames(allGames);
      return;
    }

    // Filter games that contain any of the selected school names in opponent-related columns
    const filteredGames = allGames.filter((game) => {
      return selectedSchools.some((schoolName) => {
        // Check standard opponent field
        if (game.opponent?.name === schoolName) return true;

        // Check other opponent-related columns
        return visibleColumnIds.some((columnId) => {
          const label = getColumnLabel(columnId, customColumns).toLowerCase();
          const isOpponentColumn =
            label.includes("opponent") ||
            label.includes("away") ||
            label.includes("enemy") ||
            label.includes("visiting") ||
            label.includes("visitor") ||
            label.includes("against") ||
            label.includes("vs") ||
            label.includes("versus") ||
            label.includes("school") ||
            label.includes("team");

          if (isOpponentColumn) {
            const cellValue = getCellValue(game, columnId, columnMapping);
            return cellValue === schoolName;
          }
          return false;
        });
      });
    });

    setSelectedGames(filteredGames);
  };

  const escapeHtml = (text: string) => {
    const div = document.createElement("div");
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

    // Table header - dynamically generate based on visible columns
    html += "<thead>";
    html += '<tr style="background-color: #23252a; color: white;">';
    visibleColumnIds.forEach((columnId) => {
      // Skip actions column in email
      if (columnId === "actions") return;
      const label = getColumnLabel(columnId, customColumns);
      html += `<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 0.85rem;">${escapeHtml(label)}</th>`;
    });
    html += "</tr>";
    html += "</thead>";

    // Table body
    html += "<tbody>";
    selectedGames.forEach((game, index) => {
      const bgColor = index % 2 === 0 ? "#ffffff" : "#f9fafb";
      html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid #e5e7eb;">`;

      // Generate cells dynamically based on visible columns
      visibleColumnIds.forEach((columnId) => {
        // Skip actions column in email
        if (columnId === "actions") return;

        let cellContent = "";

        // Check if this is an imported column mapped to date
        const isImportedDateColumn = columnId.startsWith("imported:") && columnMapping?.[columnId.split(":")[1]] === "date";

        // Special handling for certain columns
        if (columnId === "date" || isImportedDateColumn) {
          const rawValue = getCellValue(game, columnId, columnMapping);
          cellContent = escapeHtml(formatFullDate(rawValue));
        } else if (columnId === "status") {
          const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#BEDBFE";
          cellContent = `<span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(game.status)}</span>`;
        } else if (columnId === "isHome" || columnId === "location") {
          cellContent = game.isHome ? "<strong>Home</strong>" : escapeHtml(game.venue?.name || "TBD");
        } else {
          const rawValue = getCellValue(game, columnId, columnMapping);
          cellContent = escapeHtml(rawValue);
        }

        html += `<td style="padding: 12px; border: 1px solid #e5e7eb; font-size: 0.85rem;">${cellContent}</td>`;
      });

      html += "</tr>";

      // Add notes row if notes column is visible and game has notes
      if (visibleColumnIds.includes("notes") && game.notes) {
        const colspan = visibleColumnIds.filter((id) => id !== "actions").length;
        html += `<tr style="background-color: ${bgColor};">`;
        html += `<td colspan="${colspan}" style="padding: 8px 12px; font-size: 13px; color: #6b7280; font-style: italic; border: 1px solid #e5e7eb;">`;
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
        <Box
          sx={{
            display: "flex",
            flexDirection: isWideScreen ? "row" : "column",
            gap: 3,
            width: "100%",
          }}
        >
          {/* Selected Games Summary - Left Column */}
          <Box sx={{ flex: isWideScreen ? 1.5 : "none", width: "100%" }}>
            <Paper sx={{ p: 3, height: "100%", bgcolor: "background.paper" }}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Selected Games ({selectedGames.length}/{allGames.length})
                {selectedSchoolNames.length > 0 && (
                  <Chip label={`Filtered: ${selectedSchoolNames.length} school${selectedSchoolNames.length === 1 ? "" : "s"}`} size="small" color="primary" sx={{ ml: 1 }} />
                )}
              </Typography>
              <TableContainer sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "action.selected" }}>
                      {visibleColumnIds.map((columnId) => {
                        // Skip actions column in email preview
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
                          // Skip actions column in email preview
                          if (columnId === "actions") return null;

                          const cellValue = getCellValue(game, columnId, columnMapping);

                          // Special rendering for status column with chip
                          if (columnId === "status") {
                            return (
                              <TableCell key={columnId} sx={{ fontSize: "0.85rem" }}>
                                <Chip label={game.status} size="small" color={game.status === "CONFIRMED" ? "success" : "warning"} />
                              </TableCell>
                            );
                          }

                          // Special formatting for date column OR imported date column
                          if (columnId === "date" || (columnId.startsWith("imported:") && columnMapping?.[columnId.split(":")[1]] === "date")) {
                            return (
                              <TableCell key={columnId} sx={{ fontSize: "0.85rem" }}>
                                {formatGameDate(cellValue)}
                              </TableCell>
                            );
                          }

                          // Default rendering for all other columns
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

          {/* Email Composition - Right Column */}
          <Box sx={{ flex: isWideScreen ? 1 : "none", width: "100%" }}>
            <Paper sx={{ p: 3, height: "100%", bgcolor: "background.paper" }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Email Details
              </Typography>

              <Stack spacing={3}>
                {/* Recipient Category */}
                <TextField
                  select
                  label="Recipient Category"
                  sx={{
                    "& .MuiInputLabel-root": {
                      top: "-5px",
                    },
                  }}
                  value={recipientCategory}
                  onChange={(e) => setRecipientCategory(e.target.value)}
                  fullWidth
                  className="recipientCategory"
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

                {/* School/Opponent Filter */}
                {getAllSchoolNames.length > 0 && (
                  <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, p: 2, bgcolor: "grey.50" }}>
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
                      helperText={`Select which schools/opponents to include in the email (${getAllSchoolNames.length} available)`}
                    >
                      {getAllSchoolNames.map((schoolName) => {
                        const gameCount = allGames.filter((game) => {
                          // Check if this school appears in any opponent-related column
                          if (game.opponent?.name === schoolName) return true;

                          return visibleColumnIds.some((columnId) => {
                            const label = getColumnLabel(columnId, customColumns).toLowerCase();
                            const isOpponentColumn =
                              label.includes("opponent") ||
                              label.includes("away") ||
                              label.includes("enemy") ||
                              label.includes("visiting") ||
                              label.includes("visitor") ||
                              label.includes("against") ||
                              label.includes("vs") ||
                              label.includes("versus") ||
                              label.includes("school") ||
                              label.includes("team");

                            if (isOpponentColumn) {
                              const cellValue = getCellValue(game, columnId, columnMapping);
                              return cellValue === schoolName;
                            }
                            return false;
                          });
                        }).length;

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
                      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mt: 2 }}>
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

                {/* Subject */}
                <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth required error={!subject} helperText={!subject ? "Subject is required" : ""} />

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
        <Paper sx={{ p: 3, bgcolor: "background.paper" }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Email Preview
          </Typography>
          <Box
            sx={{
              p: 2,
              bgcolor: "background.default",
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
                visibleColumnIds: visibleColumnIds.filter((id) => id !== "actions"),
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
