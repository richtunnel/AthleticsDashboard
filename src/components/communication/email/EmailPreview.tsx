"use client";
import { useNotifications } from "@/contexts/NotificationContext";
import { useState, useEffect, useMemo, useCallback, memo } from "react";
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
import { formatLevelDisplay } from "@/lib/utils/formatters";
import { buildEmailSignatureHTML } from "@/lib/utils/email-signature";

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

export function buildEmailPreviewHtml({ mounted, theme, additionalMessage, visibleColumnIds, columnMapping, customColumns, selectedGames, emailSignature }: EmailPreviewProps) {
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
        colors: {
          primary: theme.palette.text.primary,
          secondary: theme.palette.text.secondary,
          link: theme.palette.primary.main,
          divider: theme.palette.divider,
        },
      },
    );
    if (signatureHTML) {
      html += signatureHTML;
    }
  }

  html += "</div>";

  return html;
}

export const EmailPreviewContent = memo(buildEmailPreviewHtml);

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
