"use client";

import React from "react";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { TextField } from "@mui/material";
import { CalendarMonth } from "@mui/icons-material";

interface CustomDatePickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: "small" | "medium";
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  onBlur,
  disabled = false,
  autoFocus = false,
  size = "small",
}) => {
  // Parse the date value (YYYY-MM-DD) to Date object
  const parseDate = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    
    // Extract date components from YYYY-MM-DD string
    const parts = dateStr.split('-');
    if (parts.length !== 3) return null;
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    
    // Create date object (month is 0-based in JavaScript)
    return new Date(year, month - 1, day);
  };

  // Format Date object to YYYY-MM-DD string
  const formatDate = (date: Date | null): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return "";
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    
    return `${year}-${month}-${day}`;
  };

  const dateValue = parseDate(value);

  const handleDateChange = (newDate: Date | null) => {
    const formattedDate = formatDate(newDate);
    onChange(formattedDate);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <DatePicker
        value={dateValue}
        onChange={handleDateChange}
        disabled={disabled}
        slotProps={{
          textField: {
            size: size,
            fullWidth: true,
            onBlur: onBlur,
            autoFocus: autoFocus,
            InputProps: {
              sx: { fontSize: 13 },
              endAdornment: (
                <CalendarMonth sx={{ fontSize: 18, color: 'action.active', mr: 1 }} />
              ),
            },
            sx: {
              "& .MuiOutlinedInput-root": {
                bgcolor: "transparent",
                "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
                "&:hover fieldset": { borderColor: "primary.main" },
                "&.Mui-focused fieldset": { borderColor: "primary.main" },
              },
            },
          },
        }}
      />
    </LocalizationProvider>
  );
};
