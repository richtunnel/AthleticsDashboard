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
  try {
    // Handle cases where it might already be in a readable format or include seconds
    const parts = timeString.split(":");
    if (parts.length < 2) return timeString;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);

    if (isNaN(hours) || isNaN(minutes)) return timeString;

    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);

    return format(date, "h:mm a");
  } catch (error) {
    console.warn("Error formatting time display:", error);
    return timeString;
  }
};
