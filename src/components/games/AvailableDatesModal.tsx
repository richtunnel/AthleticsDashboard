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
  Collapse,
} from '@mui/material';
import {
  Search,
  AutoAwesome,
  EventAvailable,
  Info,
  AddCircleOutline,
  ExpandMore,
  ExpandLess,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { trackEvent } from '@/lib/analytics/mixpanel.services';

interface AvailableDatesModalProps {
  open: boolean;
  onClose: () => void;
  sport?: string;
  level?: string;
  onDateSelect?: (date: Date, sport?: string, level?: string) => void;
}

interface ClusterMatch {
  sport: string;
  gender: string;
  level: string;
  confidence: number;
}

interface DebugInfo {
  parsedTokens: string[];
  matchedClusters: ClusterMatch[];
  clusterDates: string[];
  notes: string[];
}

interface AvailableDatesResult {
  recommendations: string[]; // ISO date strings
  debug: DebugInfo;
}

const formatDateDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return format(date, 'EEE, MMM d, yyyy');
  } catch {
    return dateStr;
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
  const [showDebug, setShowDebug] = useState(false);

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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to find available dates');
      }

      setResult(data);

      // Track success event
      trackEvent('Available Dates - Search Completed', {
        prompt: prompt.trim(),
        sport,
        level,
        datesFound: data.recommendations.length,
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

  const handleDateClick = (dateStr: string) => {
    if (onDateSelect) {
      const date = new Date(dateStr + 'T00:00:00');
      onDateSelect(date, sport, level);
      trackEvent('Available Dates - Date Selected', {
        selectedDate: dateStr,
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
          {/* Search Input */}
          <Box>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="e.g., 'B V Basketball' or 'GV soccer' or 'Basketball'"
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
              Examples: "B V Basketball" • "GV soccer" • "Basketball" • "Girls Varsity Volleyball"
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

              {/* Matched Teams Info */}
              {result.debug.matchedClusters.length > 0 && (
                <Alert severity="info" icon={<EventAvailable />} sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                    Matched Teams:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {result.debug.matchedClusters.slice(0, 3).map((cluster, idx) => (
                      <Chip
                        key={idx}
                        label={`${cluster.gender} ${cluster.level} ${cluster.sport}`}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                    {result.debug.matchedClusters.length > 3 && (
                      <Chip
                        label={`+${result.debug.matchedClusters.length - 3} more`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Alert>
              )}

              {/* Available Dates */}
              {result.recommendations.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                    Available Dates ({result.recommendations.length})
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
                    {result.recommendations.map((dateStr, index) => {
                      const date = new Date(dateStr + 'T00:00:00');
                      const isWeekday = date.getDay() !== 0 && date.getDay() !== 6;

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
                            minHeight: '56px',
                            '&:hover': onDateSelect ? {
                              bgcolor: 'success.light',
                              transform: 'translateY(-1px)',
                              boxShadow: 2,
                            } : {},
                          }}
                          onClick={() => onDateSelect && handleDateClick(dateStr)}
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
                                    handleDateClick(dateStr);
                                  }}
                                  sx={{ p: 0.25 }}
                                >
                                  <AddCircleOutline sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: '0.8rem', lineHeight: 1.3 }}>
                              {formatDateDisplay(dateStr)}
                            </Typography>
                            {isWeekday && (
                              <Chip
                                label="Weekday"
                                size="small"
                                sx={{
                                  height: 14,
                                  fontSize: '0.6rem',
                                  bgcolor: 'info.main',
                                  color: 'white',
                                  '& .MuiChip-label': { px: 0.5, py: 0 },
                                }}
                              />
                            )}
                          </Stack>
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
                    {result.debug.notes.join(' • ')}
                  </Typography>
                </Alert>
              )}

              {/* Debug Info (Collapsible) */}
              <Box>
                <Button
                  size="small"
                  onClick={() => setShowDebug(!showDebug)}
                  endIcon={showDebug ? <ExpandLess /> : <ExpandMore />}
                  sx={{ textTransform: 'none' }}
                >
                  {showDebug ? 'Hide' : 'Show'} Debug Info
                </Button>
                <Collapse in={showDebug}>
                  <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: 'grey.50' }}>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>Parsed Tokens:</Typography>
                        <Typography variant="caption" display="block">{result.debug.parsedTokens.join(', ')}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>Matched Clusters ({result.debug.matchedClusters.length}):</Typography>
                        {result.debug.matchedClusters.map((c, i) => (
                          <Typography key={i} variant="caption" display="block">
                            • {c.gender} {c.level} {c.sport} (score: {c.confidence.toFixed(2)})
                          </Typography>
                        ))}
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>Cluster Dates ({result.debug.clusterDates.length}):</Typography>
                        <Typography variant="caption" display="block">{result.debug.clusterDates.join(', ')}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>Notes:</Typography>
                        {result.debug.notes.map((note, i) => (
                          <Typography key={i} variant="caption" display="block">• {note}</Typography>
                        ))}
                      </Box>
                    </Stack>
                  </Paper>
                </Collapse>
              </Box>
            </>
          )}

          {/* Rate Limit Info */}
          {!loading && !result && (
            <Alert severity="info" icon={<Info />} sx={{ borderRadius: 2 }}>
              <Typography variant="caption">
                <strong>Rate Limit:</strong> You can search up to 10 times per 24 hours.
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
