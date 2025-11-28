"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  TextField,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Search,
  CalendarMonth,
  AutoAwesome,
  EventAvailable,
  Schedule,
  Info,
  AddCircleOutline,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { trackEvent } from '@/lib/analytics/mixpanel.services';

interface AvailableDatesModalProps {
  open: boolean;
  onClose: () => void;
  sport?: string;
  level?: string;
  onDateSelect?: (date: Date, time?: string, sport?: string, level?: string) => void;
}

interface DateConstraints {
  weekdays?: string[];
  between?: string;
  excludeResources?: string[];
  homeOnly?: boolean;
  awayOnly?: boolean;
  minDaysBetween?: number;
  count: number;
}

interface DateTimeRecommendation {
  date: string; // ISO string from API
  suggestedTime: string | null;
  confidence: number;
}

interface AvailableDatesResult {
  availableDates: Date[];
  recommendations?: DateTimeRecommendation[];
  constraints: DateConstraints;
  reasoning?: string;
  error?: string;
}

const formatDateDisplay = (date: Date): string => {
  try {
    return format(date, 'EEE, MMM d, yyyy');
  } catch {
    return date.toLocaleDateString();
  }
};

const formatTimeDisplay = (timeString: string | null): string => {
  if (!timeString) return 'TBD';
  try {
    const [hours, minutes] = timeString.split(':');
    if (!hours || !minutes) return timeString;
    const date = new Date();
    date.setHours(parseInt(hours, 10));
    date.setMinutes(parseInt(minutes, 10));
    return format(date, 'h:mm a');
  } catch {
    return timeString;
  }
};

export const AvailableDatesModal: React.FC<AvailableDatesModalProps> = ({
  open,
  onClose,
  sport,
  level,
  onDateSelect,
}) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AvailableDatesResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError('Please enter a search prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    // Track search event
    trackEvent('Available Dates - Search Started', {
      prompt: prompt.trim(),
      sport,
      level,
      source: 'games_table',
    });

    try {
      const response = await fetch('/api/games/find-available-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          sport,
          level,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find available dates');
      }

      // Convert date strings to Date objects
      const availableDates = data.availableDates.map((d: string) => new Date(d));

      setResult({
        availableDates,
        recommendations: data.recommendations,
        constraints: data.constraints,
        reasoning: data.reasoning,
      });

      // Track success event
      trackEvent('Available Dates - Search Completed', {
        prompt: prompt.trim(),
        sport,
        level,
        datesFound: availableDates.length,
        requestedCount: data.constraints.count,
        source: 'games_table',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);

      // Track error event
      trackEvent('Available Dates - Search Failed', {
        prompt: prompt.trim(),
        sport,
        level,
        error: errorMessage,
        source: 'games_table',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (date: Date, suggestedTime?: string | null) => {
    if (onDateSelect) {
      onDateSelect(date, suggestedTime || undefined, sport, level);
      trackEvent('Available Dates - Date Selected', {
        selectedDate: date.toISOString().split('T')[0],
        suggestedTime: suggestedTime || 'none',
        sport,
        level,
        source: 'games_table',
      });
    }
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Clear results when user starts typing a new prompt
  const handlePromptChange = (value: string) => {
    setPrompt(value);
    // Clear results to allow fresh search
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AutoAwesome sx={{ color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Find Available Dates
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Use natural language to find open dates in your schedule
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Current Context */}
          {(sport || level) && (
            <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                Searching for <strong>{sport || 'any sport'}</strong>
                {level && ` (${level})`} games
              </Typography>
            </Alert>
          )}

          {/* Search Input */}
          <Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="e.g., 'Dates in July' or 'Weekend dates in March' or 'Find 5 home games in April'"
              value={prompt}
              onChange={(e) => handlePromptChange(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                },
              }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Examples: "Dates in July" • "Weekend dates in August" • "5 home games in March"
            </Typography>
          </Box>

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Analyzing your schedule and finding available dates...
              </Typography>
            </Box>
          )}

          {/* Error State */}
          {error && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Results */}
          {result && !loading && (
            <>
              <Divider />
              
              {/* Reasoning */}
              {result.reasoning && (
                <Alert severity="success" icon={<EventAvailable />} sx={{ borderRadius: 2 }}>
                  <Typography variant="body2">
                    {result.reasoning}
                  </Typography>
                </Alert>
              )}

              {/* Applied Constraints */}
              {(result.constraints.weekdays || result.constraints.homeOnly || result.constraints.awayOnly) && (
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                    Applied Filters:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {result.constraints.weekdays && (
                      <Chip
                        icon={<CalendarMonth sx={{ fontSize: 14 }} />}
                        label={result.constraints.weekdays.join(', ')}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {result.constraints.homeOnly && (
                      <Chip
                        label="Home Games Only"
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                    {result.constraints.awayOnly && (
                      <Chip
                        label="Away Games Only"
                        size="small"
                        variant="outlined"
                        color="primary"
                      />
                    )}
                    {result.constraints.minDaysBetween && (
                      <Chip
                        icon={<Schedule sx={{ fontSize: 14 }} />}
                        label={`${result.constraints.minDaysBetween}+ days apart`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Box>
              )}

              {/* Available Dates */}
              {result.availableDates.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                    Available Dates ({result.availableDates.length})
                  </Typography>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: 1,
                      maxHeight: '350px',
                      overflowY: 'auto',
                      pr: 0.5,
                    }}
                  >
                    {result.availableDates.map((date, index) => {
                      const recommendation = result.recommendations?.find(
                        r => new Date(r.date).toISOString().split('T')[0] === date.toISOString().split('T')[0]
                      );
                      const suggestedTime = recommendation?.suggestedTime;
                      const confidence = recommendation?.confidence || 0;

                      return (
                        <Paper
                          key={index}
                          elevation={0}
                          sx={{
                            p: 1,
                            bgcolor: 'success.lighter',
                            border: '1px solid',
                            borderColor: 'success.light',
                            borderRadius: 1.5,
                            cursor: onDateSelect ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                            minHeight: suggestedTime ? '72px' : '56px',
                            '&:hover': onDateSelect ? {
                              bgcolor: 'success.light',
                              transform: 'translateY(-1px)',
                              boxShadow: 2,
                            } : {},
                          }}
                          onClick={() => onDateSelect && handleDateClick(date, suggestedTime)}
                        >
                          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                            <Typography
                              variant="caption"
                              sx={{
                                bgcolor: 'success.main',
                                color: 'white',
                                px: 0.5,
                                py: 0.125,
                                borderRadius: 0.5,
                                fontWeight: 600,
                                fontSize: '0.65rem',
                                lineHeight: 1.2,
                              }}
                            >
                              #{index + 1}
                            </Typography>
                            {onDateSelect && (
                              <Tooltip title="Add to schedule">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDateClick(date, suggestedTime);
                                  }}
                                  sx={{ p: 0.25 }}
                                >
                                  <AddCircleOutline sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem', lineHeight: 1.3 }}>
                            {formatDateDisplay(date)}
                          </Typography>
                          {suggestedTime && (
                            <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap">
                              <Schedule sx={{ fontSize: 12, color: 'text.secondary' }} />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                {formatTimeDisplay(suggestedTime)}
                              </Typography>
                              {confidence > 0.7 && (
                                <Chip
                                  label="Pattern"
                                  size="small"
                                  sx={{
                                    height: 14,
                                    fontSize: '0.6rem',
                                    bgcolor: 'success.main',
                                    color: 'white',
                                    '& .MuiChip-label': { px: 0.5, py: 0 },
                                  }}
                                />
                              )}
                            </Stack>
                          )}
                        </Paper>
                      );
                    })}
                  </Box>
                  {onDateSelect && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ display: 'block', mt: 1, textAlign: 'center', fontSize: '0.7rem' }}
                    >
                      Click the + icon or card to add a date to your schedule
                    </Typography>
                  )}
                </Box>
              ) : (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2">
                    No available dates found matching your criteria. Try adjusting your search or expanding the date range.
                  </Typography>
                </Alert>
              )}
            </>
          )}

          {/* Rate Limit Info */}
          {!loading && !result && (
            <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2 }}>
              <Typography variant="caption">
                <strong>Rate Limit:</strong> You can search up to 10 times per 24 hours. This helps keep costs low while providing powerful AI-powered scheduling assistance.
              </Typography>
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          onClick={onClose}
          variant="outlined"
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          Close
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search />}
          disabled={loading || !prompt.trim()}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          {loading ? 'Searching...' : 'Find Dates'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
