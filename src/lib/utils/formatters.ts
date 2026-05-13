import { format } from "date-fns";

/**
 * Format level values for display
 * Converts database values (e.g., "VARSITY") to proper case (e.g., "Varsity")
 */
export const formatLevelDisplay = (level: string): string => {
  switch (level) {
    case "VARSITY":
      return "Varsity";
    case "JV":
      return "JV";
    case "FRESHMAN":
      return "Freshman";
    case "MIDDLE_SCHOOL":
      return "Middle School";
    case "YOUTH":
      return "Youth";
    default:
      // For any custom values, capitalize first letter of each word
      return level
        .split("_")
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(" ");
  }
};

/**
 * Robustly extract date part (YYYY-MM-DD) from a date string
 * Handles ISO strings with T, spaces, and other date formats
 */
export const extractDatePart = (dateValue: string): string => {
  if (!dateValue) return "";
  try {
    // If it's already in YYYY-MM-DD format, return it
    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateValue;
    }
    // If it includes time (ISO string), extract date part
    if (dateValue.includes("T")) {
      return dateValue.split("T")[0];
    }
    // Try to parse and format
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) {
      return format(parsed, "yyyy-MM-dd");
    }
    return dateValue;
  } catch (error) {
    console.warn("Error extracting date part:", error);
    return dateValue;
  }
};

/**
 * Format time display to 12-hour format (AM/PM)
 * Expects time in HH:mm format (24-hour)
 */
export const formatTimeDisplay = (timeString: string | null): string => {
  if (!timeString || timeString.toUpperCase() === "TBD") return "TBD";

  const trimmed = timeString.trim();

  // If already in 12-hour format (e.g. "6:00 PM" or "6:00:00 PM") return
  // canonical "H:MM AM/PM" form (seconds stripped if present).
  const amPmInput = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (amPmInput) {
    const h = parseInt(amPmInput[1], 10);
    const m = amPmInput[2];
    const period = amPmInput[3].toUpperCase();
    return `${h}:${m} ${period}`;
  }

  // Expect raw 24-hour "HH:MM" (with optional seconds appended)
  const parts = trimmed.split(":");
  if (parts.length < 2) return trimmed;

  const h24 = parseInt(parts[0], 10);
  const min = parseInt(parts[1], 10);

  if (isNaN(h24) || isNaN(min) || h24 < 0 || h24 > 23 || min < 0 || min > 59) return trimmed;

  // Pure-math 24 → 12 hour conversion (no date-fns, no Date object,
  // no timezone ambiguity — guaranteed to produce the correct result).
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 % 12 || 12; // 0 → 12 (midnight), 12 → 12 (noon), 13 → 1, …
  return `${h12}:${min.toString().padStart(2, "0")} ${period}`;
};
