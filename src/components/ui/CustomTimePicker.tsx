"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  IconButton,
  Popover,
  Typography,
  Button,
  Stack,
  Paper,
  useTheme,
  TextField,
  InputAdornment,
} from "@mui/material";
import {
  Schedule as ScheduleIcon,
  KeyboardArrowUp,
  KeyboardArrowDown,
} from "@mui/icons-material";

interface CustomTimePickerProps {
  value: string; // HH:MM format
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: "small" | "medium";
}

export const CustomTimePicker: React.FC<CustomTimePickerProps> = ({
  value,
  onChange,
  onBlur,
  disabled = false,
  autoFocus = false,
  size = "small",
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [hours, setHours] = useState<number>(0);
  const [minutes, setMinutes] = useState<number>(0);
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [inputValue, setInputValue] = useState<string>("");
  const [inputError, setInputError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatDisplayTime = (timeValue?: string) => {
    const timeToFormat = timeValue ?? value;
    if (!timeToFormat) return "TBD";
    const [h, m] = timeToFormat.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "TBD";
    const isPM = h >= 12;
    const displayHours = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHours}:${m.toString().padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
  };

  // Parse the initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const isPM = h >= 12;
        setPeriod(isPM ? "PM" : "AM");
        setHours(h === 0 ? 12 : h > 12 ? h - 12 : h);
        setMinutes(m);
        setInputValue(formatDisplayTime(value));
      }
    } else {
      setInputValue("");
      // Default to current time for picker
      const now = new Date();
      const h = now.getHours();
      const isPM = h >= 12;
      setPeriod(isPM ? "PM" : "AM");
      setHours(h === 0 ? 12 : h > 12 ? h - 12 : h);
      setMinutes(now.getMinutes());
    }
  }, [value]);

  // Auto-focus behavior
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const parseTimeInput = (input: string): string | null => {
    if (!input || input.toLowerCase() === "tbd") {
      return "";
    }

    const normalized = input.trim().toLowerCase();

    // Match various time formats
    // HH:MM AM/PM or H:MM AM/PM (e.g., "3:30 PM", "03:30 pm")
    const format12Hour = normalized.match(/^(\d{1,2}):(\d{1,2})\s*(am|pm)$/);
    if (format12Hour) {
      let h = parseInt(format12Hour[1], 10);
      const m = parseInt(format12Hour[2], 10);
      const period = format12Hour[3];
      
      if (h < 1 || h > 12 || m < 0 || m > 59) {
        return null;
      }
      
      if (period === "pm" && h !== 12) h += 12;
      if (period === "am" && h === 12) h = 0;
      
      // Always return normalized HH:MM format with leading zeros
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }

    // HH:MM or H:MM or HH:M or H:M 24-hour format (e.g., "15:30", "3:30", "9:5")
    const format24Hour = normalized.match(/^(\d{1,2}):(\d{1,2})$/);
    if (format24Hour) {
      const h = parseInt(format24Hour[1], 10);
      const m = parseInt(format24Hour[2], 10);
      
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        return null;
      }
      
      // Always return normalized HH:MM format with leading zeros
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }

    // HHMM format (e.g., "1530", "330", "0900")
    const formatCompact = normalized.match(/^(\d{1,4})$/);
    if (formatCompact) {
      const digits = formatCompact[1].padStart(4, "0");
      const h = parseInt(digits.slice(0, 2), 10);
      const m = parseInt(digits.slice(2, 4), 10);
      
      if (h < 0 || h > 23 || m < 0 || m > 59) {
        return null;
      }
      
      // Always return normalized HH:MM format with leading zeros
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
    }

    return null;
  };

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (!disabled) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleApply = () => {
    // Convert to 24-hour format
    let h24 = hours;
    if (period === "PM" && hours !== 12) {
      h24 = hours + 12;
    } else if (period === "AM" && hours === 12) {
      h24 = 0;
    }
    
    const timeString = `${h24.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    onChange(timeString);
    setInputValue(formatDisplayTime(timeString));
    setInputError("");
    handleClose();
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value;
    setInputValue(newValue);
    setInputError("");
  };

  const handleInputBlur = () => {
    const parsed = parseTimeInput(inputValue);
    
    if (parsed === "") {
      // Empty or "TBD" - clear the time
      onChange("");
      setInputValue("");
      setInputError("");
    } else if (parsed === null) {
      // Invalid format
      setInputError("Invalid time format");
      // Revert to previous value
      if (value) {
        setInputValue(formatDisplayTime(value));
      } else {
        setInputValue("");
      }
    } else {
      // Valid time
      onChange(parsed);
      setInputValue(formatDisplayTime(parsed));
      setInputError("");
    }
    
    if (onBlur) {
      onBlur();
    }
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleInputBlur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      // Revert to previous value
      if (value) {
        setInputValue(formatDisplayTime(value));
      } else {
        setInputValue("");
      }
      setInputError("");
      if (onBlur) {
        onBlur();
      }
    }
  };

  const handleHoursChange = (delta: number) => {
    setHours((prev) => {
      let newHours = prev + delta;
      if (newHours > 12) newHours = 1;
      if (newHours < 1) newHours = 12;
      return newHours;
    });
  };

  const handleMinutesChange = (delta: number) => {
    setMinutes((prev) => {
      let newMinutes = prev + delta;
      if (newMinutes >= 60) newMinutes = 0;
      if (newMinutes < 0) newMinutes = 55;
      return newMinutes;
    });
  };

  const open = Boolean(anchorEl);
  const id = open ? "time-picker-popover" : undefined;

  return (
    <Box ref={containerRef} sx={{ width: "100%" }}>
      <TextField
        inputRef={inputRef}
        size="small"
        fullWidth
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleInputKeyDown}
        disabled={disabled}
        placeholder="Enter time (e.g., 3:30 PM)"
        error={!!inputError}
        helperText={inputError}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                onClick={handleOpen}
                disabled={disabled}
                edge="end"
                sx={{ mr: -0.5 }}
              >
                <ScheduleIcon sx={{ fontSize: 20 }} />
              </IconButton>
            </InputAdornment>
          ),
          sx: {
            fontSize: size === "small" ? 13 : 14,
          },
        }}
        FormHelperTextProps={{
          sx: { fontSize: 10, mt: 0.5 },
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "transparent",
            "& fieldset": { borderColor: "rgba(0, 0, 0, 0.23)" },
            "&:hover fieldset": { borderColor: "primary.main" },
            "&.Mui-focused fieldset": { borderColor: "primary.main" },
          },
        }}
      />

      <Popover
        id={id}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.5,
              boxShadow: theme.shadows[8],
              border: "1px solid",
              borderColor: "divider",
            },
          },
        }}
      >
        <Paper sx={{ p: 2, minWidth: 280 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ fontSize: 12, color: "text.secondary", textAlign: "center" }}>
              Select Time
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
              {/* Hours */}
              <Stack alignItems="center" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => handleHoursChange(1)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                  }}
                >
                  <KeyboardArrowUp fontSize="small" />
                </IconButton>
                <Box
                  sx={{
                    width: 60,
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    borderRadius: 1,
                    fontWeight: 600,
                    fontSize: 24,
                  }}
                >
                  {hours.toString().padStart(2, "0")}
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleHoursChange(-1)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                  }}
                >
                  <KeyboardArrowDown fontSize="small" />
                </IconButton>
              </Stack>

              <Typography variant="h4" sx={{ fontWeight: 600, color: "text.secondary", mb: 2 }}>
                :
              </Typography>

              {/* Minutes */}
              <Stack alignItems="center" spacing={0.5}>
                <IconButton
                  size="small"
                  onClick={() => handleMinutesChange(5)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                  }}
                >
                  <KeyboardArrowUp fontSize="small" />
                </IconButton>
                <Box
                  sx={{
                    width: 60,
                    height: 48,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "primary.main",
                    color: "primary.contrastText",
                    borderRadius: 1,
                    fontWeight: 600,
                    fontSize: 24,
                  }}
                >
                  {minutes.toString().padStart(2, "0")}
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleMinutesChange(-5)}
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                  }}
                >
                  <KeyboardArrowDown fontSize="small" />
                </IconButton>
              </Stack>

              {/* AM/PM Toggle */}
              <Stack alignItems="center" spacing={0.5}>
                <Button
                  size="small"
                  variant={period === "AM" ? "contained" : "outlined"}
                  onClick={() => setPeriod("AM")}
                  sx={{
                    width: 56,
                    minWidth: 56,
                    height: 36,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  AM
                </Button>
                <Button
                  size="small"
                  variant={period === "PM" ? "contained" : "outlined"}
                  onClick={() => setPeriod("PM")}
                  sx={{
                    width: 56,
                    minWidth: 56,
                    height: 36,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  PM
                </Button>
              </Stack>
            </Stack>

            {/* Quick time buttons */}
            <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap">
              {[
                { label: "8:00 AM", h: 8, m: 0, p: "AM" },
                { label: "12:00 PM", h: 12, m: 0, p: "PM" },
                { label: "3:00 PM", h: 3, m: 0, p: "PM" },
                { label: "6:00 PM", h: 6, m: 0, p: "PM" },
              ].map((preset) => (
                <Button
                  key={preset.label}
                  size="small"
                  variant="text"
                  onClick={() => {
                    setHours(preset.h);
                    setMinutes(preset.m);
                    setPeriod(preset.p as "AM" | "PM");
                  }}
                  sx={{
                    fontSize: 11,
                    minWidth: "auto",
                    px: 1,
                    py: 0.5,
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </Stack>

            {/* Action buttons */}
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button size="small" variant="text" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="small" variant="contained" onClick={handleApply}>
                Apply
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Popover>
    </Box>
  );
};
