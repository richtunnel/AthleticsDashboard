/**
 * Robust date and time parsing utilities for CSV imports
 * Handles multiple date/time formats commonly found in Excel and CSV exports
 */

import { parse, isValid, format } from 'date-fns';

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
  
  // Try parsing as ISO string first (fastest path)
  const isoDate = new Date(dateStr);
  if (isValid(isoDate) && !isNaN(isoDate.getTime())) {
    return isoDate;
  }
  
  // Try each format
  for (const formatStr of DATE_FORMATS) {
    try {
      const parsed = parse(dateStr, formatStr, new Date());
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
 * Parse date string flexibly and convert to UTC ISO string
 * This is the main function to use for CSV imports
 * @param dateValue - Date string in any common format
 * @returns UTC ISO string or throws error if parsing fails
 */
export function parseAndConvertDate(dateValue: string | number | null | undefined): string {
  if (!dateValue) {
    throw new Error('Date value is required');
  }
  
  const parsed = parseFlexibleDate(dateValue);
  
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
  
  return dateToUTCISOString(parsed);
}

/**
 * Parse time string flexibly and convert to HH:MM format
 * This is the main function to use for CSV imports
 * @param timeValue - Time string in any common format
 * @returns Time string in HH:MM format or throws error if parsing fails
 */
export function parseAndConvertTime(timeValue: string | number | null | undefined): string | null {
  if (!timeValue) {
    return null; // Time is optional
  }
  
  const parsed = parseFlexibleTime(timeValue);
  
  if (!parsed) {
    throw new Error(
      `Could not parse time: "${timeValue}". ` +
      `Please use a format like HH:MM, H:MM AM/PM, or HH:MM:SS`
    );
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
