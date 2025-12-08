/**
 * Time validation and normalization utilities for Google Calendar sync compatibility
 * Ensures all time values are stored in HH:MM format (24-hour with leading zeros)
 */

/**
 * Validates and normalizes time string to HH:MM format
 * Accepts various formats and auto-corrects to proper format
 * 
 * Supported input formats:
 * - HH:MM (already correct) - "14:30", "09:00"
 * - H:MM (single digit hour) - "3:30", "9:00"
 * - HH:M (single digit minute) - "14:5", "09:0"
 * - H:M (both single digit) - "3:5", "9:0"
 * 
 * @param timeStr - Time string to validate/normalize
 * @returns Normalized time in HH:MM format or null if invalid/empty
 * @throws Error if time format is completely invalid
 */
export function normalizeTimeFormat(timeStr: string | null | undefined): string | null {
  // Handle null, undefined, or empty string
  if (!timeStr || timeStr.trim() === '') {
    return null;
  }

  const trimmed = timeStr.trim();

  // Check if it's a TBD/placeholder value
  const tbdPatterns = ['tbd', 't.b.d', 'to be determined', 'to be decided', 'tba', 't.b.a', 'to be announced', 'pending', 'none', 'n/a', 'not set', 'unknown'];
  if (tbdPatterns.some(pattern => trimmed.toLowerCase() === pattern)) {
    return null;
  }

  // Match HH:MM, H:MM, HH:M, or H:M format
  const timePattern = /^(\d{1,2}):(\d{1,2})$/;
  const match = trimmed.match(timePattern);

  if (!match) {
    throw new Error(`Invalid time format: "${timeStr}". Expected format: HH:MM (e.g., 14:30, 09:00)`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  // Validate time ranges
  if (hours < 0 || hours > 23) {
    throw new Error(`Invalid hour: ${hours}. Hours must be between 0 and 23`);
  }

  if (minutes < 0 || minutes > 59) {
    throw new Error(`Invalid minute: ${minutes}. Minutes must be between 0 and 59`);
  }

  // Normalize to HH:MM format with leading zeros
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Validates that a time string is in correct HH:MM format
 * More strict than normalizeTimeFormat - only accepts properly formatted times
 * 
 * @param timeStr - Time string to validate
 * @returns true if valid HH:MM format, false otherwise
 */
export function isValidTimeFormat(timeStr: string | null | undefined): boolean {
  if (!timeStr) return true; // null/empty is valid (optional field)

  const match = timeStr.match(/^([01][0-9]|2[0-3]):([0-5][0-9])$/);
  if (!match) return false;

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}

/**
 * Validates and normalizes time with detailed error messages
 * Used in API endpoints to provide user-friendly error messages
 * 
 * @param timeStr - Time string to validate/normalize
 * @param fieldName - Name of the field for error messages (default: "time")
 * @returns Object with normalized value or error message
 */
export function validateAndNormalizeTime(
  timeStr: string | null | undefined,
  fieldName: string = "time"
): { value: string | null; error: null } | { value: null; error: string } {
  try {
    const normalized = normalizeTimeFormat(timeStr);
    return { value: normalized, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : `Invalid ${fieldName} format`;
    return { value: null, error: message };
  }
}
