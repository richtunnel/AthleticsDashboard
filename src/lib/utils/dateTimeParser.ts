/**
 * Robust date and time parsing utilities for CSV imports
 * Handles multiple date/time formats commonly found in Excel and CSV exports
 */

import { parse, isValid, format } from 'date-fns';

/**
 * Result type for parsing operations that includes warnings
 */
export interface ParseResult<T> {
  value: T;
  warnings: string[];
}

/**
 * Known placeholders for "to be determined" times
 */
const TBD_PATTERNS = [
  /^tbd$/i,
  /^t\.b\.d\.?$/i,
  /^to be determined$/i,
  /^to be decided$/i,
  /^tba$/i,
  /^t\.b\.a\.?$/i,
  /^to be announced$/i,
  /^pending$/i,
  /^none$/i,
  /^n\/a$/i,
  /^not set$/i,
  /^unknown$/i,
];

/**
 * Common date formats to try when parsing dates
 * Ordered by likelihood/popularity
 */
const DATE_FORMATS = [
  // ISO formats
  'yyyy-MM-dd',
  'yyyy/MM/dd',
  
  // US formats (most common in Excel)
  'MM/dd/yyyy',
  'M/d/yyyy',
  'MM-dd-yyyy',
  'M-d-yyyy',
  
  // Month name formats
  'MMMM d, yyyy',      // November 17, 2025
  'MMM d, yyyy',       // Nov 17, 2025
  'MMM. d, yyyy',      // Nov. 17, 2025
  'MMMM dd, yyyy',     // November 17, 2025
  'MMM dd, yyyy',      // Nov 17, 2025
  'MMM. dd, yyyy',     // Nov. 17, 2025
  
  // Day-first formats (European)
  'dd/MM/yyyy',
  'd/M/yyyy',
  'dd-MM-yyyy',
  'd-M-yyyy',
  
  // Compact formats
  'yyyyMMdd',
  'MM/dd/yy',
  'M/d/yy',
  'dd/MM/yy',
  'd/M/yy',
  
  // Readable formats
  'd MMMM yyyy',       // 17 November 2025
  'd MMM yyyy',        // 17 Nov 2025
  'd MMM. yyyy',       // 17 Nov. 2025
  'dd MMMM yyyy',      // 17 November 2025
  'dd MMM yyyy',       // 17 Nov 2025
  'dd MMM. yyyy',      // 17 Nov. 2025
];

/**
 * Common time formats to try when parsing times
 * Ordered by likelihood/popularity
 */
const TIME_FORMATS = [
  // 24-hour formats
  'HH:mm',
  'H:mm',
  'HH:mm:ss',
  'H:mm:ss',
  
  // 12-hour formats with AM/PM
  'hh:mm a',
  'h:mm a',
  'hh:mm:ss a',
  'h:mm:ss a',
  'hh:mma',
  'h:mma',
  
  // With periods
  'hh:mm A',
  'h:mm A',
  'hh:mm:ss A',
  'h:mm:ss A',
  'hh:mmA',
  'h:mmA',
];

/**
 * Normalize date string by handling special cases like date ranges
 * @param dateValue - The date string to normalize
 * @returns Normalized string and any warnings
 */
function normalizeDateString(dateValue: string): ParseResult<string> {
  const warnings: string[] = [];
  let normalized = dateValue.trim();
  
  // Handle date ranges (e.g., "Dec. 18 - 22, 2025" or "18-22 Nov 2025")
  // Pattern: date followed by " - " or " to " and another number/date
  const rangePatterns = [
    // "Dec. 18 - 22, 2025" -> "Dec. 18, 2025"
    /^(\w+\.?\s+\d{1,2})\s*[-–]\s*\d{1,2}(,\s*\d{4})$/,
    // "Nov 18-22, 2025" -> "Nov 18, 2025"
    /^(\w+\s+\d{1,2})[-–]\d{1,2}(,\s*\d{4})$/,
    // "18-22 Nov 2025" -> "18 Nov 2025"
    /^(\d{1,2})[-–]\d{1,2}\s+(\w+\s+\d{4})$/,
    // "12/18 - 12/22/2025" -> "12/18/2025"
    /^(\d{1,2}\/\d{1,2})\/?\s*[-–]\s*\d{1,2}\/\d{1,2}(\/\d{4})$/,
  ];
  
  for (const pattern of rangePatterns) {
    const match = normalized.match(pattern);
    if (match) {
      // Extract first date from range
      if (match[1] && match[2]) {
        normalized = `${match[1]}${match[2]}`;
      } else if (match[1] && !match[2]) {
        normalized = match[1];
      }
      warnings.push(`Date range detected. Using first date from range: "${dateValue}" → "${normalized}"`);
      break;
    }
  }
  
  return { value: normalized, warnings };
}

/**
 * Parse a date string in various formats and return a Date object
 * @param dateValue - The date string to parse
 * @returns Date object or null if parsing fails
 */
export function parseFlexibleDate(dateValue: string | number | null | undefined): Date | null {
  if (!dateValue) return null;
  
  // Handle Excel serial date numbers
  if (typeof dateValue === 'number') {
    return parseExcelSerialDate(dateValue);
  }
  
  const dateStr = String(dateValue).trim();
  if (!dateStr) return null;
  
  // Normalize date string (handles ranges and special cases)
  const { value: normalizedStr } = normalizeDateString(dateStr);
  
  // Try parsing as ISO string first (fastest path)
  const isoDate = new Date(normalizedStr);
  if (isValid(isoDate) && !isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try each format
  for (const formatStr of DATE_FORMATS) {
    try {
      const parsed = parse(normalizedStr, formatStr, new Date());
      if (isValid(parsed)) {
        return parsed;
      }
    } catch {
      // Continue to next format
    }
  }
  
  return null;
}

/**
 * Check if a string is a TBD/placeholder value
 * @param value - The string to check
 * @returns true if it's a TBD pattern
 */
function isTBDValue(value: string): boolean {
  const trimmed = value.trim();
  return TBD_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Check if a string looks like it could be a time (contains colons or digits)
 * @param value - The string to check
 * @returns true if it looks like a time format
 */
function looksLikeTime(value: string): boolean {
  const trimmed = value.trim();
  // Check if it contains time-like patterns
  return /\d/.test(trimmed) && (/[:,.]/.test(trimmed) || /\d\s*[ap]m/i.test(trimmed));
}

/**
 * Parse a time string in various formats and return HH:MM format
 * @param timeValue - The time string to parse
 * @returns Time string in HH:MM format or null if parsing fails
 */
export function parseFlexibleTime(timeValue: string | number | null | undefined): string | null {
  if (!timeValue) return null;
  
  // Handle Excel serial time numbers (fraction of a day)
  if (typeof timeValue === 'number') {
    return parseExcelSerialTime(timeValue);
  }
  
  const timeStr = String(timeValue).trim();
  if (!timeStr) return null;
  
  // Check if it's a TBD/placeholder value - return null without error
  if (isTBDValue(timeStr)) {
    return null;
  }
  
  // If it doesn't look like a time at all, return null
  // This handles cases like tournament names (e.g., "Sarachek")
  if (!looksLikeTime(timeStr)) {
    return null;
  }
  
  // If already in HH:MM or H:MM format, validate and return
  const simpleTimeMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (simpleTimeMatch) {
    const hours = parseInt(simpleTimeMatch[1], 10);
    const minutes = parseInt(simpleTimeMatch[2], 10);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }
  
  // Try each time format with a reference date
  const referenceDate = new Date(2000, 0, 1); // Jan 1, 2000
  
  for (const formatStr of TIME_FORMATS) {
    try {
      const parsed = parse(timeStr, formatStr, referenceDate);
      if (isValid(parsed)) {
        return format(parsed, 'HH:mm');
      }
    } catch {
      // Continue to next format
    }
  }
  
  return null;
}

/**
 * Parse Excel serial date number to Date object
 * Excel stores dates as number of days since 1900-01-01
 * @param serialDate - Excel serial date number
 * @returns Date object or null if invalid
 */
function parseExcelSerialDate(serialDate: number): Date | null {
  if (serialDate < 1 || serialDate > 2958465) {
    // Valid range: 1900-01-01 to 9999-12-31
    return null;
  }
  
  // Excel incorrectly treats 1900 as a leap year
  // Adjust for this bug if date is after Feb 28, 1900
  const adjustedSerial = serialDate > 59 ? serialDate - 1 : serialDate;
  
  // Convert to JavaScript date (milliseconds since 1970-01-01)
  const milliseconds = (adjustedSerial - 25569) * 86400 * 1000;
  const date = new Date(milliseconds);
  
  return isValid(date) ? date : null;
}

/**
 * Parse Excel serial time number to HH:MM string
 * Excel stores times as fraction of a day (0 to 1)
 * @param serialTime - Excel serial time number (0 to 1)
 * @returns Time string in HH:MM format or null if invalid
 */
function parseExcelSerialTime(serialTime: number): string | null {
  // Handle full datetime serial numbers (integer + fraction)
  const timeFraction = serialTime % 1;
  
  if (timeFraction < 0 || timeFraction >= 1) {
    return null;
  }
  
  const totalMinutes = Math.round(timeFraction * 24 * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  if (hours >= 24 || minutes >= 60) {
    return null;
  }
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Convert a parsed date to UTC ISO string for database storage
 * Creates date at noon UTC to avoid timezone boundary issues
 * @param date - Date object to convert
 * @returns ISO string in UTC
 */
export function dateToUTCISOString(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  
  // Create date at noon UTC to avoid any date boundary issues
  const utcDate = new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
  
  return utcDate.toISOString();
}

/**
 * Parse date string flexibly and convert to UTC ISO string with warnings
 * This is the main function to use for CSV imports
 * @param dateValue - Date string in any common format
 * @param includeWarnings - If true, return object with value and warnings
 * @returns UTC ISO string or ParseResult with warnings, or throws error if parsing fails
 */
export function parseAndConvertDate(
  dateValue: string | number | null | undefined,
  includeWarnings?: false
): string;
export function parseAndConvertDate(
  dateValue: string | number | null | undefined,
  includeWarnings: true
): ParseResult<string>;
export function parseAndConvertDate(
  dateValue: string | number | null | undefined,
  includeWarnings = false
): string | ParseResult<string> {
  if (!dateValue) {
    throw new Error('Date value is required');
  }
  
  const warnings: string[] = [];
  let dateStr = String(dateValue);
  
  // Normalize date string (handles ranges and special cases)
  if (typeof dateValue === 'string') {
    const normalized = normalizeDateString(dateValue);
    dateStr = normalized.value;
    warnings.push(...normalized.warnings);
  }
  
  const parsed = parseFlexibleDate(dateStr);
  
  if (!parsed) {
    throw new Error(
      `Could not parse date: "${dateValue}". ` +
      `Please use a common date format like YYYY-MM-DD, MM/DD/YYYY, or "Month DD, YYYY"`
    );
  }
  
  // Validate the parsed date is reasonable
  const year = parsed.getFullYear();
  if (year < 1900 || year > 2100) {
    throw new Error(
      `Invalid year: ${year}. Year must be between 1900 and 2100`
    );
  }
  
  const isoString = dateToUTCISOString(parsed);
  
  if (includeWarnings) {
    return { value: isoString, warnings };
  }
  
  return isoString;
}

/**
 * Parse time string flexibly and convert to HH:MM format with warnings
 * This is the main function to use for CSV imports
 * @param timeValue - Time string in any common format
 * @param includeWarnings - If true, return object with value and warnings
 * @returns Time string in HH:MM format, null if TBD/empty, or ParseResult with warnings, or throws error if parsing fails
 */
export function parseAndConvertTime(
  timeValue: string | number | null | undefined,
  includeWarnings?: false
): string | null;
export function parseAndConvertTime(
  timeValue: string | number | null | undefined,
  includeWarnings: true
): ParseResult<string | null>;
export function parseAndConvertTime(
  timeValue: string | number | null | undefined,
  includeWarnings = false
): string | null | ParseResult<string | null> {
  if (!timeValue) {
    if (includeWarnings) {
      return { value: null, warnings: [] };
    }
    return null; // Time is optional
  }
  
  const warnings: string[] = [];
  const timeStr = String(timeValue).trim();
  
  // Check if it's a TBD/placeholder value
  if (isTBDValue(timeStr)) {
    warnings.push(`Time marked as TBD/pending: "${timeValue}" - set to empty`);
    if (includeWarnings) {
      return { value: null, warnings };
    }
    return null;
  }
  
  // Check if it doesn't look like a time at all (e.g., tournament name)
  if (!looksLikeTime(timeStr)) {
    warnings.push(`Time field contains non-time value: "${timeValue}" - set to empty. This might be a tournament name or other text.`);
    if (includeWarnings) {
      return { value: null, warnings };
    }
    return null;
  }
  
  const parsed = parseFlexibleTime(timeValue);
  
  if (!parsed) {
    throw new Error(
      `Could not parse time: "${timeValue}". ` +
      `Please use a format like HH:MM, H:MM AM/PM, or HH:MM:SS`
    );
  }
  
  if (includeWarnings) {
    return { value: parsed, warnings };
  }
  
  return parsed;
}

/**
 * Validate that a time string is in HH:MM format
 * @param timeStr - Time string to validate
 * @returns true if valid, false otherwise
 */
export function isValidTimeFormat(timeStr: string | null | undefined): boolean {
  if (!timeStr) return true; // null/empty is valid (optional field)
  
  const match = timeStr.match(/^(\d{2}):(\d{2})$/);
  if (!match) return false;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}
