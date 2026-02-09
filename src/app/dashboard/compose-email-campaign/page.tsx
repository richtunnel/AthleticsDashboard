"use client";

import ComposeEmailPage from "@/components/communication/email/ComposeEmail";

export interface Game {
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
  customFields?: Record<string, unknown>;
  customData?: Record<string, unknown>;
}

export interface CustomColumn {
  id: string;
  name: string;
  type: string;
}

export interface TablePreferencesData {
  customColumns?: string[];
  columnMapping?: Record<string, string>;
  hidden?: string[];
  [key: string]: unknown;
}

export interface EmailGroupCategory {
  value: string;
  label: string;
  groupId?: string;
  isEmailGroup?: boolean;
}

export const STATIC_RECIPIENT_CATEGORIES: EmailGroupCategory[] = [{ value: "custom", label: "Custom Recipients" }];

export interface EmailPreviewProps {
  mounted: boolean;
  theme: any;
  additionalMessage: string;
  visibleColumnIds: string[];
  columnMapping: Record<string, string> | undefined;
  customColumns: CustomColumn[];
  selectedGames: Game[];
  emailSignature: any;
}

/**
 * Get display columns based on user preferences and custom columns
 */
export const getDisplayColumns = (preferences: TablePreferencesData | null, customColumns: CustomColumn[]): string[] => {
  const hiddenColumns = new Set<string>(Array.isArray(preferences?.hidden) ? (preferences.hidden as string[]) : []);

  const importedColumns = preferences?.customColumns as string[] | undefined;
  const columnMapping = preferences?.columnMapping as Record<string, string> | undefined;

  let allColumns: string[];

  if (importedColumns && columnMapping && importedColumns.length > 0) {
    const importedIds = importedColumns
      .filter((colName) => {
        const mapping = columnMapping[colName];
        return mapping && mapping !== "skip";
      })
      .map((colName) => `imported:${colName}`);

    const customIds = customColumns.map((col) => `custom:${col.id}`);
    allColumns = [...importedIds, ...customIds];
  } else {
    const defaultColumns = ["date", "sport", "level", "opponent", "location", "status", "time", "notes"];
    const customIds = customColumns.map((col) => `custom:${col.id}`);
    allColumns = [...defaultColumns, ...customIds];
  }

  return allColumns.filter((columnId) => !hiddenColumns.has(columnId));
};

/**
 * Get column label
 */
export const getColumnLabel = (columnId: string, customColumns: CustomColumn[]): string => {
  if (columnId.startsWith("imported:")) {
    return columnId.split(":")[1];
  }

  if (columnId.startsWith("custom:")) {
    const customId = columnId.split(":")[1];
    const customColumn = customColumns.find((col) => col.id === customId);
    return customColumn?.name || "Custom Field";
  }

  const labelMap: Record<string, string> = {
    date: "Date",
    sport: "Sport",
    level: "Level",
    opponent: "Opponent",
    isHome: "Location",
    location: "Location",
    time: "Time",
    status: "Confirmed",
    notes: "Notes",
  };

  return labelMap[columnId] || columnId;
};

/**
 * Get cell value for a column
 */
export const getCellValue = (game: Game, columnId: string, columnMapping?: Record<string, string>): string => {
  if (columnId.startsWith("imported:")) {
    const columnName = columnId.split(":")[1];
    const mapping = columnMapping?.[columnName];

    if (mapping === "date") {
      return game.date;
    } else if (mapping === "time") {
      return game.time || "TBD";
    }

    const customFields = game.customFields || {};
    return String(customFields[columnName] || "—");
  }

  if (columnId.startsWith("custom:")) {
    const customId = columnId.split(":")[1];
    const customData = (game.customData as Record<string, unknown>) || {};
    return String(customData[customId] || "—");
  }

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

/**
 * Check if column is opponent-related
 */
const isOpponentColumn = (columnLabel: string): boolean => {
  const lower = columnLabel.toLowerCase();
  return ["opponent", "away", "enemy", "visiting", "visitor", "against", "vs", "versus", "school", "team"].some((keyword) => lower.includes(keyword));
};

/**
 * Extract all school names from games
 */
export const getAllSchoolNamesFromGames = (games: Game[], visibleColumnIds: string[], columnMapping: Record<string, string> | undefined, customColumns: CustomColumn[]): string[] => {
  const schoolNamesSet = new Set<string>();

  const opponentColumns = visibleColumnIds.filter((columnId) => {
    const label = getColumnLabel(columnId, customColumns);
    return isOpponentColumn(label);
  });

  games.forEach((game) => {
    opponentColumns.forEach((columnId) => {
      const value = getCellValue(game, columnId, columnMapping);
      if (value && value !== "—" && value !== "TBD" && value !== "Home" && value.trim()) {
        schoolNamesSet.add(value.trim());
      }
    });

    if (game.opponent?.name && game.opponent.name !== "TBD") {
      schoolNamesSet.add(game.opponent.name);
    }
  });

  return Array.from(schoolNamesSet).sort();
};

/**
 * Get game count for a school
 */
export const getGameCountForSchool = (schoolName: string, games: Game[], visibleColumnIds: string[], columnMapping: Record<string, string> | undefined, customColumns: CustomColumn[]): number => {
  return games.filter((game) => {
    if (game.opponent?.name === schoolName) return true;

    return visibleColumnIds.some((columnId) => {
      const label = getColumnLabel(columnId, customColumns);
      if (!isOpponentColumn(label)) return false;

      const cellValue = getCellValue(game, columnId, columnMapping);
      return cellValue === schoolName;
    });
  }).length;
};

/**
 * Filter games by school names
 */
export const filterGamesBySchools = (
  games: Game[],
  selectedSchools: string[],
  visibleColumnIds: string[],
  columnMapping: Record<string, string> | undefined,
  customColumns: CustomColumn[],
): Game[] => {
  if (selectedSchools.length === 0) return games;

  return games.filter((game) => {
    return selectedSchools.some((schoolName) => {
      if (game.opponent?.name === schoolName) return true;

      return visibleColumnIds.some((columnId) => {
        const label = getColumnLabel(columnId, customColumns);
        if (!isOpponentColumn(label)) return false;

        const cellValue = getCellValue(game, columnId, columnMapping);
        return cellValue === schoolName;
      });
    });
  });
};

/**
 * Safe HTML escape
 */
export const escapeHtml = (text: string | null | undefined): string => {
  if (!text) return "";

  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };

  return text.replace(/[&<>"']/g, (char) => map[char]);
};

/**
 * Format date string
 */
export const formatGameDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    return `${String(month + 1).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
  } catch {
    return dateString;
  }
};

export const EmailPreviewContent = memo(function EmailPreviewContent({
  mounted,
  theme,
  additionalMessage,
  visibleColumnIds,
  columnMapping,
  customColumns,
  selectedGames,
  emailSignature,
}: EmailPreviewProps) {
  if (!mounted) return "<p>Loading preview...</p>";

  const isDarkMode = theme.palette.mode === "dark";
  const headingColor = isDarkMode ? theme.palette.text.primary : "#23252a";
  const messageBoxBg = isDarkMode ? theme.palette.background.paper : "#f3f4f6";
  const messageBoxBorder = isDarkMode ? theme.palette.primary.main : "#23252a";
  const tableHeaderBg = isDarkMode ? theme.palette.action.selected : "#23252a";
  const tableHeaderText = isDarkMode ? theme.palette.text.primary : "white";
  const borderColor = isDarkMode ? theme.palette.divider : "#e5e7eb";
  const evenRowBg = isDarkMode ? theme.palette.background.paper : "#ffffff";
  const oddRowBg = isDarkMode ? theme.palette.action.hover : "#f9fafb";

  let html = '<div style="font-family: Arial, sans-serif; max-width: 1180px; margin: 0 auto;">';

  html += `<h2 style="color: ${headingColor}; margin-bottom: 16px;">Game Schedule Confirmation</h2>`;

  if (additionalMessage) {
    html += `<div style="margin-bottom: 24px; padding: 16px; background-color: ${messageBoxBg}; border-left: 4px solid ${messageBoxBorder}; border-radius: 4px;">`;
    html += `<p style="margin: 0; white-space: pre-wrap; color: ${theme.palette.text.primary};">${escapeHtml(additionalMessage)}</p>`;
    html += "</div>";
  }

  html += '<table style="width: 100%; border-collapse: collapse; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 0.85rem;">';

  html += "<thead>";
  html += `<tr style="background-color: ${tableHeaderBg}; color: ${tableHeaderText};">`;
  visibleColumnIds.forEach((columnId) => {
    if (columnId === "actions") return;
    const label = getColumnLabel(columnId, customColumns);
    html += `<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid ${borderColor}; font-size: 0.85rem;">${escapeHtml(label)}</th>`;
  });
  html += "</tr>";
  html += "</thead>";

  html += "<tbody>";
  selectedGames.forEach((game, index) => {
    const bgColor = index % 2 === 0 ? evenRowBg : oddRowBg;
    html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid ${borderColor};">`;

    visibleColumnIds.forEach((columnId) => {
      if (columnId === "actions") return;

      let cellContent = "";

      const isImportedDateColumn = columnId.startsWith("imported:") && columnMapping?.[columnId.split(":")[1]] === "date";

      if (columnId === "date" || isImportedDateColumn) {
        const rawValue = getCellValue(game, columnId, columnMapping);
        cellContent = escapeHtml(formatGameDate(rawValue));
      } else if (columnId === "status") {
        const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#BEDBFE";
        cellContent = `<span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(game.status)}</span>`;
      } else if (columnId === "isHome" || columnId === "location") {
        cellContent = game.isHome ? "<strong>Home</strong>" : escapeHtml(game.venue?.name || "TBD");
      } else {
        const rawValue = getCellValue(game, columnId, columnMapping);
        cellContent = escapeHtml(rawValue);
      }

      html += `<td style="padding: 12px; border: 1px solid ${borderColor}; color: ${theme.palette.text.primary}; font-size: 0.85rem;">${cellContent}</td>`;
    });

    html += "</tr>";

    if (visibleColumnIds.includes("notes") && game.notes) {
      const colspan = visibleColumnIds.filter((id) => id !== "actions").length;
      html += `<tr style="background-color: ${bgColor};">`;
      html += `<td colspan="${colspan}" style="padding: 8px 12px; font-size: 13px; color: ${theme.palette.text.secondary}; font-style: italic; border: 1px solid ${borderColor};">`;
      html += `<strong>Note:</strong> ${escapeHtml(game.notes)}`;
      html += "</td>";
      html += "</tr>";
    }
  });
  html += "</tbody>";
  html += "</table>";

  html += `<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid ${borderColor};">`;
  html += `<p style="color: ${theme.palette.text.secondary}; font-size: 14px; margin: 8px 0;">If you have any questions, please contact the athletic department.</p>`;
  html += `<p style="color: ${theme.palette.text.secondary}; font-size: 12px; margin: 8px 0;">This is an automated message from Opletics.</p>`;
  html += "</div>";

  if (emailSignature) {
    const signatureHTML = buildEmailSignatureHTML(
      {
        signaturePhone: emailSignature.signaturePhone,
        signatureWebsite: emailSignature.signatureWebsite,
        signatureLogoUrl: emailSignature.signatureLogoUrl,
        signatureText: emailSignature.signatureText,
      },
      {
        baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
        useOptimizedImages: true,
      },
    );
    if (signatureHTML) {
      html += signatureHTML;
    }
  }

  html += "</div>";

  return html;
});

/**
 * Memoized preview box to prevent re-renders during typing
 */
export interface EmailPreviewBoxProps {
  html: string;
}

export const EmailPreviewBox = memo(function EmailPreviewBox({ html }: EmailPreviewBoxProps) {
  return (
    <Box
      sx={{
        p: 2,
        bgcolor: "background.default",
        borderRadius: 1,
        border: "1px solid",
        borderColor: "divider",
        maxHeight: 400,
        overflow: "auto",
        minHeight: 200, // Prevent collapse
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
interface SnackbarState {
  open: boolean;
  message: string;
  severity: AlertColor;
}

const DEFAULT_SNACKBAR: SnackbarState = {
  open: false,
  message: "",
  severity: "success",
};

async function sendCampaign(payload: { subject: string; body: string; groupId: string }) {
  const response = await fetch("/api/email-campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, sendNow: true }),
  });

  if (!response.ok) {
    let message = "Failed to send campaign";

    try {
      const data = await response.json();
      if (data?.error) {
        message = data.error;
      }
    } catch (error) {
      // ignore parse errors
    }

    throw new Error(message);
  }

  return response.json();
}

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
  const { data: emailGroups = [], isLoading: emailGroupsLoading } = useQuery<EmailGroup[], Error>({
    queryKey: ["email-groups"],
    queryFn: fetchEmailGroups,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const { data: emailSignatureData } = useQuery({
    queryKey: ["email-signature"],
    queryFn: async () => {
      const res = await fetch("/api/user/email-signature");
      if (!res.ok) return null;
      const data = await res.json();
      return data.data || null;
    },
  });

  // Normalize signature data to ensure it has the correct structure
  const emailSignature = emailSignatureData
    ? {
        signaturePhone: emailSignatureData.signaturePhone || "",
        signatureWebsite: emailSignatureData.signatureWebsite || "",
        signatureLogoUrl: emailSignatureData.signatureLogoUrl || "",
        signatureText: emailSignatureData.signatureText || "",
      }
    : null;

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

  // Generate preview HTML - memoized to prevent recalculation during typing
  const emailPreviewHtml = useMemo(() => {
    if (!mounted) return "<p>Loading preview...</p>";

    const isDarkMode = theme.palette.mode === "dark";
    const headingColor = isDarkMode ? theme.palette.text.primary : "#23252a";
    const messageBoxBg = isDarkMode ? theme.palette.background.paper : "#f3f4f6";
    const messageBoxBorder = isDarkMode ? theme.palette.primary.main : "#23252a";
    const tableHeaderBg = isDarkMode ? theme.palette.action.selected : "#23252a";
    const tableHeaderText = isDarkMode ? theme.palette.text.primary : "white";
    const borderColor = isDarkMode ? theme.palette.divider : "#e5e7eb";
    const evenRowBg = isDarkMode ? theme.palette.background.paper : "#ffffff";
    const oddRowBg = isDarkMode ? theme.palette.action.hover : "#f9fafb";

    let html = '<div style="font-family: Arial, sans-serif; max-width: 1180px; margin: 0 auto;">';

    html += `<h2 style="color: ${headingColor}; margin-bottom: 16px;">Game Schedule Confirmation</h2>`;

    if (additionalMessage) {
      html += `<div style="margin-bottom: 24px; padding: 16px; background-color: ${messageBoxBg}; border-left: 4px solid ${messageBoxBorder}; border-radius: 4px;">`;
      html += `<p style="margin: 0; white-space: pre-wrap; color: ${theme.palette.text.primary};">${escapeHtml(additionalMessage)}</p>`;
      html += "</div>";
    }

    html += '<table style="width: 100%; border-collapse: collapse; margin-top: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); font-size: 0.85rem;">';

    html += "<thead>";
    html += `<tr style="background-color: ${tableHeaderBg}; color: ${tableHeaderText};">`;
    visibleColumnIds.forEach((columnId) => {
      if (columnId === "actions") return;
      const label = getColumnLabel(columnId, customColumns);
      html += `<th style="padding: 12px; text-align: left; font-weight: 600; border: 1px solid ${borderColor}; font-size: 0.85rem;">${escapeHtml(label)}</th>`;
    });
    html += "</tr>";
    html += "</thead>";

    html += "<tbody>";
    selectedGames.forEach((game, index) => {
      const bgColor = index % 2 === 0 ? evenRowBg : oddRowBg;
      html += `<tr style="background-color: ${bgColor}; border-bottom: 1px solid ${borderColor};">`;

      visibleColumnIds.forEach((columnId) => {
        if (columnId === "actions") return;

        let cellContent = "";

        const isImportedDateColumn = columnId.startsWith("imported:") && columnMapping?.[columnId.split(":")[1]] === "date";

        if (columnId === "date" || isImportedDateColumn) {
          const rawValue = getCellValue(game, columnId, columnMapping);
          cellContent = escapeHtml(formatGameDate(rawValue));
        } else if (columnId === "status") {
          const statusColor = game.status === "CONFIRMED" ? "#22c55e" : "#BEDBFE";
          cellContent = `<span style="background-color: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;">${escapeHtml(game.status)}</span>`;
        } else if (columnId === "isHome" || columnId === "location") {
          cellContent = game.isHome ? "<strong>Home</strong>" : escapeHtml(game.venue?.name || "TBD");
        } else {
          const rawValue = getCellValue(game, columnId, columnMapping);
          cellContent = escapeHtml(rawValue);
        }

        html += `<td style="padding: 12px; border: 1px solid ${borderColor}; color: ${theme.palette.text.primary}; font-size: 0.85rem;">${cellContent}</td>`;
      });

      html += "</tr>";

      if (visibleColumnIds.includes("notes") && game.notes) {
        const colspan = visibleColumnIds.filter((id) => id !== "actions").length;
        html += `<tr style="background-color: ${bgColor};">`;
        html += `<td colspan="${colspan}" style="padding: 8px 12px; font-size: 13px; color: ${theme.palette.text.secondary}; font-style: italic; border: 1px solid ${borderColor};">`;
        html += `<strong>Note:</strong> ${escapeHtml(game.notes)}`;
        html += "</td>";
        html += "</tr>";
      }
    });
    html += "</tbody>";
    html += "</table>";

    html += `<div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid ${borderColor};">`;
    html += `<p style="color: ${theme.palette.text.secondary}; font-size: 14px; margin: 8px 0;">If you have any questions, please contact the athletic department.</p>`;
    html += `<p style="color: ${theme.palette.text.secondary}; font-size: 12px; margin: 8px 0;">This is an automated message from Opletics.</p>`;
    html += "</div>";

    if (emailSignature) {
      const signatureHTML = buildEmailSignatureHTML(
        {
          signaturePhone: emailSignature.signaturePhone,
          signatureWebsite: emailSignature.signatureWebsite,
          signatureLogoUrl: emailSignature.signatureLogoUrl,
          signatureText: emailSignature.signatureText,
        },
        {
          baseUrl: typeof window !== "undefined" ? window.location.origin : undefined,
          useOptimizedImages: true,
        },
      );
      if (signatureHTML) {
        html += signatureHTML;
      }
    }

    html += "</div>";

    return html;
    // Only recalculate when these change - NOT additionalMessage
  }, [mounted, theme, visibleColumnIds, columnMapping, customColumns, selectedGames, emailSignature]);

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
        } else if (games.length > 0 && !subject) {
          // Generate default subject only if no draft
          if (games.length === 1) {
            setSubject(`Game Confirmation: ${games[0].homeTeam.sport.name} vs ${games[0].opponent?.name || "TBD"}`);
          } else {
            setSubject(`Game Schedule Confirmation - ${games.length} Games`);
          }
        }
      }
    } catch (e) {
      console.error("Error loading stored data:", e);
    }
  }, [mounted, visibleColumnIds, columnMapping, customColumns]);

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
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
        }}
      >
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
        <Box
          sx={{
            display: "flex",
            flexDirection: isWideScreen ? "row" : "column",
            gap: 3,
            width: "100%",
          }}
        >
          {/* Selected Games */}
          <Box sx={{ flex: isWideScreen ? 1.5 : "none", width: "100%" }}>
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

          {/* Email Composition */}
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
                  variant="outlined"
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

                {/* Custom Recipients */}
                {recipientCategory === "custom" && (
                  <TextField
                    label="Email Addresses"
                    variant="outlined"
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
                      bgcolor: "grey.50",
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                      Filter by School/Opponent
                    </Typography>

                    <TextField
                      select
                      label="Select Schools/Opponents"
                      variant="outlined"
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

                {/* Subject */}
                <TextField label="Subject" variant="outlined" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth required error={!subject} helperText={!subject ? "Subject is required" : ""} />

                {/* Additional Message */}
                <TextField
                  label="Additional Message (Optional)"
                  variant="outlined"
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

        {/* Email Preview - Memoized to prevent jank */}
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
            type="button"
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
                selectedSchoolNames,
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
