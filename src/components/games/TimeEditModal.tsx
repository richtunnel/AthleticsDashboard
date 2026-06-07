"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
} from "@mui/material";
import { CustomTimePicker } from "../ui/CustomTimePicker";

interface TimeEditModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (time: string) => void;
  initialValue: string;
  gameInfo?: {
    date: string;
    opponent?: string;
  };
}

export const TimeEditModal: React.FC<TimeEditModalProps> = ({
  open,
  onClose,
  onSave,
  initialValue,
  gameInfo,
}) => {
  const [timeValue, setTimeValue] = useState<string>(initialValue);

  useEffect(() => {
    setTimeValue(initialValue);
  }, [initialValue, open]);

  const handleSave = () => {
    onSave(timeValue);
    onClose();
  };

  const handleCancel = () => {
    setTimeValue(initialValue);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: 18 }}>
          Edit Game Time
        </Typography>
        {gameInfo && (
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
            {gameInfo.opponent && `vs ${gameInfo.opponent} • `}
            {gameInfo.date}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 2, pb: 3 }}>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1.5, color: "text.secondary" }}>
            You can type the time manually or use the clock picker:
          </Typography>
          <CustomTimePicker
            value={timeValue}
            onChange={setTimeValue}
            autoFocus
            size="medium"
          />
        </Box>
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: "grey.50",
            borderRadius: 1,
            border: "1px solid",
            borderColor: "grey.200",
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 0.5 }}>
            Supported formats:
          </Typography>
          <Typography variant="caption" sx={{ color: "text.secondary", display: "block", lineHeight: 1.6 }}>
            • 3:30 PM, 9:00 AM, 6:45 PM
            <br />• Type "TBD" or leave empty for no time
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} variant="text" color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
