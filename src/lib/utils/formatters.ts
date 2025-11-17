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
