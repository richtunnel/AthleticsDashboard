"use client";

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  Chip,
  Alert,
  Divider,
} from '@mui/material';
import {
  Warning,
  Schedule,
  CalendarMonth,
  Sports,
  EmojiEvents,
} from '@mui/icons-material';
import { format } from 'date-fns';

interface Conflict {
  gameId: string;
  date: string;
  time: string;
  sport: string;
  level: string;
  opponent: string;
}

interface ConflictDetectionModalProps {
  open: boolean;
  onClose: () => void;
  conflicts: Conflict[];
  suggestedTimes: string[];
  onSelectTime: (time: string) => void;
  onProceedAnyway: () => void;
  currentTime: string;
  sport: string;
  level: string;
  date: string;
}

const formatTimeDisplay = (time: string): string => {
  if (!time) return 'TBD';
  
  try {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  } catch {
    return time;
  }
};

const formatDateDisplay = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateString;
  }
};

export const ConflictDetectionModal: React.FC<ConflictDetectionModalProps> = ({
  open,
  onClose,
  conflicts,
  suggestedTimes,
  onSelectTime,
  onProceedAnyway,
  currentTime,
  sport,
  level,
  date,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Warning sx={{ color: 'warning.main', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Scheduling Conflict Detected
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Current Selection Info */}
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
              You are trying to schedule:
            </Typography>
            <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 1 }}>
              <Chip
                icon={<Sports sx={{ fontSize: 16 }} />}
                label={sport}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<EmojiEvents sx={{ fontSize: 16 }} />}
                label={level}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<CalendarMonth sx={{ fontSize: 16 }} />}
                label={formatDateDisplay(date)}
                size="small"
                variant="outlined"
              />
              <Chip
                icon={<Schedule sx={{ fontSize: 16 }} />}
                label={formatTimeDisplay(currentTime)}
                size="small"
                variant="outlined"
                color="warning"
              />
            </Stack>
          </Alert>

          {/* Conflicts List */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
              Conflicting Games ({conflicts.length})
            </Typography>
            <Stack spacing={1.5}>
              {conflicts.map((conflict, index) => (
                <Box
                  key={conflict.gameId}
                  sx={{
                    p: 2,
                    bgcolor: 'error.lighter',
                    borderRadius: 2,
                    border: '1px solid',
                    borderColor: 'error.light',
                  }}
                >
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography
                      variant="caption"
                      sx={{
                        bgcolor: 'error.main',
                        color: 'white',
                        px: 1,
                        py: 0.5,
                        borderRadius: 1,
                        fontWeight: 600,
                      }}
                    >
                      #{index + 1}
                    </Typography>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      <strong>{conflict.sport}</strong> ({conflict.level}) vs{' '}
                      <strong>{conflict.opponent}</strong>
                    </Typography>
                    <Chip
                      icon={<Schedule sx={{ fontSize: 14 }} />}
                      label={formatTimeDisplay(conflict.time)}
                      size="small"
                      color="error"
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>

          <Divider />

          {/* Suggested Alternative Times */}
          {suggestedTimes.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Suggested Alternative Times
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {suggestedTimes.map((time) => (
                  <Button
                    key={time}
                    variant="outlined"
                    size="small"
                    startIcon={<Schedule />}
                    onClick={() => onSelectTime(time)}
                    sx={{
                      textTransform: 'none',
                      borderRadius: 2,
                      px: 2,
                      '&:hover': {
                        bgcolor: 'success.lighter',
                        borderColor: 'success.main',
                        color: 'success.main',
                      },
                    }}
                  >
                    {formatTimeDisplay(time)}
                  </Button>
                ))}
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1 }}
              >
                Based on your scheduling patterns and available slots
              </Typography>
            </Box>
          )}

          {/* Warning about proceeding */}
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            <Typography variant="caption">
              <strong>Note:</strong> Having multiple games for the same team at the same time
              can cause scheduling issues for coaches, players, and facilities. Consider
              selecting an alternative time or adjusting one of the conflicting games.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Cancel
        </Button>
        <Button
          onClick={onProceedAnyway}
          variant="contained"
          color="warning"
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Proceed Anyway
        </Button>
      </DialogActions>
    </Dialog>
  );
};
