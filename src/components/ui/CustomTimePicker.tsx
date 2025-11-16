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
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the initial value
  useEffect(() => {
    if (value) {
      const [h, m] = value.split(":").map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        const isPM = h >= 12;
        setPeriod(isPM ? "PM" : "AM");
        setHours(h === 0 ? 12 : h > 12 ? h - 12 : h);
        setMinutes(m);
      }
    } else {
      // Default to current time
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
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
    }
  }, [autoFocus]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    if (!disabled) {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClose = () => {
    setAnchorEl(null);
    if (onBlur) {
      onBlur();
    }
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
    handleClose();
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

  const formatDisplayTime = () => {
    if (!value) return "TBD";
    const [h, m] = value.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "TBD";
    const isPM = h >= 12;
    const displayHours = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${displayHours}:${m.toString().padStart(2, "0")} ${isPM ? "PM" : "AM"}`;
  };

  const open = Boolean(anchorEl);
  const id = open ? "time-picker-popover" : undefined;

  return (
    <Box ref={containerRef} sx={{ width: "100%" }}>
      <Box
        onClick={handleOpen}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: size === "small" ? 0.75 : 1,
          border: "1px solid",
          borderColor: disabled ? "action.disabled" : "divider",
          borderRadius: 1,
          cursor: disabled ? "not-allowed" : "pointer",
          bgcolor: disabled ? "action.disabledBackground" : "background.paper",
          "&:hover": {
            borderColor: disabled ? "action.disabled" : "primary.main",
            bgcolor: disabled ? "action.disabledBackground" : "action.hover",
          },
          transition: "all 0.2s",
        }}
      >
        <ScheduleIcon sx={{ fontSize: 18, color: disabled ? "action.disabled" : "action.active" }} />
        <Typography
          variant="body2"
          sx={{
            fontSize: size === "small" ? 13 : 14,
            color: disabled ? "text.disabled" : "text.primary",
            flex: 1,
          }}
        >
          {formatDisplayTime()}
        </Typography>
      </Box>

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
