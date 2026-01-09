"use client";

import React, { useState } from "react";
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
  ToggleButton,
  ToggleButtonGroup,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { Search, AutoAwesome, EventAvailable, Info, AddCircleOutline, ExpandMore, ExpandLess, DragIndicator, Settings } from "@mui/icons-material";
import { format } from "date-fns";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import Draggable from "react-draggable";
import { alpha } from "@mui/material/styles";

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
  excludedClusters?: ClusterMatch[];
  excludedClusterDates?: string[];
  notes: string[];
  excludedDays?: string[];
  dateRange?: { start?: string; end?: string; month?: string; months?: string[] };
  minSpacing?: number;
  interpretation?: string;
  recommendation?: string;
}

interface AvailableDatesResult {
  recommendations: string[]; // ISO date strings
  debug: DebugInfo;
}

const formatDateDisplay = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return format(date, "EEE, MMM d, yyyy");
  } catch {
    return dateStr;
  }
};

// Draggable Paper component for the modal
function DraggablePaper(props: any) {
  const nodeRef = React.useRef(null);
  return (
    <Draggable handle="#draggable-dialog-title" cancel={'[class*="MuiDialogContent-root"]'} nodeRef={nodeRef}>
      <Paper {...props} ref={nodeRef} />
    </Draggable>
  );
}

const DAYS_OF_WEEK = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export const AvailableDatesModal: React.FC<AvailableDatesModalProps> = ({ open, onClose, sport, level, onDateSelect }) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AvailableDatesResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [excludeDays, setExcludeDays] = useState<number[]>([]);
  const [maxResults, setMaxResults] = useState<number>(10);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showConfiguration, setShowConfiguration] = useState<boolean>(true);

  // Pre-fill prompt if sport and level are provided
  React.useEffect(() => {
    if (open && (sport || level) && !prompt) {
      setPrompt(`Find available dates for ${sport || ""} ${level || ""}`.trim());
    }
  }, [open, sport, level]);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      setError("Please enter a search prompt");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    // Track search event
    trackEvent("Available Dates - Search Started", {
      prompt: prompt.trim(),
      sport,
      level,
      source: "games_table",
      excludeDays: excludeDays.length > 0 ? excludeDays : undefined,
      year: selectedYear,
    });

    try {
      const response = await fetch("/api/games/find-available-dates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          excludeDays: excludeDays.length > 0 ? excludeDays : undefined,
          maxResults,
          year: selectedYear,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to find available dates");
      }

      setResult(data);

      // Track success event
      trackEvent("Available Dates - Search Completed", {
        prompt: prompt.trim(),
        sport,
        level,
        datesFound: data.recommendations.length,
        source: "games_table",
        year: selectedYear,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);

      // Track error event
      trackEvent("Available Dates - Search Failed", {
        prompt: prompt.trim(),
        sport,
        level,
        error: errorMessage,
        source: "games_table",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = (dateStr: string) => {
    if (onDateSelect) {
      const date = new Date(dateStr + "T00:00:00");
      onDateSelect(date, sport, level);
      trackEvent("Available Dates - Date Selected", {
        selectedDate: dateStr,
        sport,
        level,
        source: "games_table",
      });
    }
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
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

  // Handle day of week toggle
  const handleDayToggle = (_event: React.MouseEvent<HTMLElement>, newExcludeDays: number[]) => {
    setExcludeDays(newExcludeDays);
    // Clear results when filter changes
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  // Handle year change
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    // Clear results when filter changes
    if (result) {
      setResult(null);
      setError(null);
    }
  };

  // Generate year options (current year and next 2 years)
  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    return [currentYear, currentYear + 1, currentYear + 2];
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperComponent={DraggablePaper}
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle
        id="draggable-dialog-title"
        sx={{
          cursor: "move",
          userSelect: "none",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <DragIndicator sx={{ color: "text.secondary", fontSize: 20 }} />
          <AutoAwesome sx={{ color: "primary.main", fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Find Available Dates
          </Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5, ml: 5 }}>
          Use natural language to find open dates • Drag to move
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          <Stack spacing={3}>
            {/* Search Input */}
            <Box>
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="e.g., 'Find me open days for girls varsity soccer 3 days apart.'"
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={loading}
                variant="outlined"
                sx={{
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                  },
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                Try: "Give me some dates for girls varsity soccer at least 4 days apart"
              </Typography>
            </Box>

            {/* Configuration Accordion */}
            <Accordion
              expanded={showConfiguration}
              onChange={() => setShowConfiguration(!showConfiguration)}
              sx={{
                boxShadow: "none",
                "&:before": { display: "none" },
                "&.Mui-expanded": { margin: 0 },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                aria-controls="configuration-content"
                id="configuration-header"
                sx={{
                  minHeight: 56,
                  "&.Mui-expanded": { minHeight: 56 },
                  borderRadius: 1,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
                  "&:hover": {
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08),
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Settings sx={{ color: "primary.main", fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Search Settings
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0, pt: 2 }}>
                {/* Filters Row - Year and Exclude Days */}
                <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                  {/* Year Filter */}
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      Year
                    </Typography>
                    <FormControl size="small" fullWidth>
                      <Select value={selectedYear} onChange={(e) => handleYearChange(e.target.value as number)} disabled={loading}>
                        {generateYearOptions().map((year) => (
                          <MenuItem key={year} value={year}>
                            {year}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Select the year to search through all 12 months
                    </Typography>
                  </Box>

                  {/* Exclude Days Filter */}
                  <Box sx={{ flex: 2, minWidth: 250 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                      Exclude Days (Optional)
                    </Typography>
                    <ToggleButtonGroup
                      value={excludeDays}
                      onChange={handleDayToggle}
                      aria-label="exclude days of week"
                      size="small"
                      disabled={loading}
                      sx={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                        "& .MuiToggleButton-root": {
                          borderRadius: 1,
                          px: 1.5,
                          py: 0.5,
                          textTransform: "none",
                          border: "1px solid",
                          borderColor: "divider",
                          "&.Mui-selected": {
                            bgcolor: "error.light",
                            color: "error.dark",
                            borderColor: "error.main",
                            "&:hover": {
                              bgcolor: "error.main",
                              color: "white",
                            },
                          },
                        },
                      }}
                    >
                      {DAYS_OF_WEEK.map((day) => (
                        <ToggleButton key={day.value} value={day.value} aria-label={day.label}>
                          {day.label}
                        </ToggleButton>
                      ))}
                    </ToggleButtonGroup>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Click to exclude days from the search results
                    </Typography>
                  </Box>
                </Box>

                {/* Number of Results */}
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                    Number of Results
                  </Typography>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={maxResults}
                      onChange={(e) => {
                        setMaxResults(e.target.value as number);
                        // Clear results when limit changes
                        if (result) {
                          setResult(null);
                          setError(null);
                        }
                      }}
                      disabled={loading}
                    >
                      <MenuItem value={10}>10 dates</MenuItem>
                      <MenuItem value={25}>25 dates</MenuItem>
                      <MenuItem value={50}>50 dates</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    Maximum number of dates to display
                  </Typography>
                </Box>

                {/* AI Info Banner */}
                <Alert severity="info" icon={<AutoAwesome />} sx={{ borderRadius: 2 }}>
                  <Typography variant="body2">
                    <strong>AI-Powered Search:</strong> Use natural language to find dates with constraints like "in December", "at least 3 days apart", or "not on same days as other teams"
                  </Typography>
                </Alert>
              </AccordionDetails>
            </Accordion>
          </Stack>

          {/* Loading State */}
          {loading && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, py: 3 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                Using AI to analyze your schedule and finding available dates...
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

              {/* AI Interpretation & Recommendation */}
              {/* {(result.debug.interpretation || result.debug.recommendation) && (
                <Alert
                  severity="success"
                  icon={<AutoAwesome />}
                  sx={{
                    borderRadius: 2,
                    bgcolor: (theme) => (theme.palette.mode === "dark" ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.success.main, 0.05)),
                    "& .MuiAlert-message": { width: "100%" },
                  }}
                >
                  {result.debug.interpretation && (
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: result.debug.recommendation ? 0.5 : 0 }}>
                      {result.debug.interpretation}
                    </Typography>
                  )}
                  {result.debug.recommendation && (
                    <Typography variant="body2" sx={{ fontStyle: "italic", color: "text.primary" }}>
                      "{result.debug.recommendation}"
                    </Typography>
                  )}
                </Alert>
              )} */}

              {/* Matched Teams Info */}
              {result.debug.matchedClusters.length > 0 && (
                <Alert severity="info" icon={<EventAvailable />} sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                    Matched Teams:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {result.debug.matchedClusters.slice(0, 3).map((cluster, idx) => (
                      <Chip key={idx} label={`${cluster.gender} ${cluster.level} ${cluster.sport}`} size="small" color="primary" variant="outlined" />
                    ))}
                    {result.debug.matchedClusters.length > 3 && <Chip label={`+${result.debug.matchedClusters.length - 3} more`} size="small" variant="outlined" />}
                  </Stack>
                </Alert>
              )}

              {/* Excluded Days Info */}
              {result.debug.excludedDays && result.debug.excludedDays.length > 0 && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Excluding: {result.debug.excludedDays.join(", ")}
                  </Typography>
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
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                      gap: 2.5,
                      maxHeight: "350px",
                      overflowY: "auto",
                      pr: 0.5,
                      p: 1,
                    }}
                  >
                    {result.recommendations.map((dateStr, index) => {
                      const date = new Date(dateStr + "T00:00:00");
                      const isWeekday = date.getDay() !== 0 && date.getDay() !== 6;

                      // Get matched teams to display
                      const matchedTeams = result.debug.matchedClusters.map((c) => `${c.gender} ${c.level} ${c.sport}`);

                      return (
                        <Paper
                          key={index}
                          elevation={0}
                          sx={(theme) => ({
                            p: "10px 20px",
                            bgcolor: theme.palette.mode === "dark" ? "#081417ed" : "success.lighter",
                            border: "1px solid",
                            borderColor: theme.palette.mode === "dark" ? "rgb(79, 109, 165)" : "#272D60",
                            borderRadius: 1.5,
                            cursor: onDateSelect ? "pointer" : "default",
                            transition: "all 0.2s",
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.5,
                            minHeight: "80px",
                            "&:hover": onDateSelect
                              ? {
                                  bgcolor: theme.palette.mode === "dark" ? "rgb(8, 20, 23)" : "rgb(239, 249, 254)",
                                  transform: "translateY(-1px)",
                                  boxShadow: 2,
                                }
                              : {},
                          })}
                          onClick={() => onDateSelect && handleDateClick(dateStr)}
                        >
                          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                            {/* <Typography
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
                            )} */}
                          </Stack>
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <Typography variant="body2" sx={{ fontWeight: 600, fontSize: "0.8rem", lineHeight: 1.3 }}>
                              {formatDateDisplay(dateStr)}
                            </Typography>
                          </Stack>
                          {/* Display matched team(s) */}
                          <Box sx={{ mt: 0.5 }}>
                            <Typography
                              variant="caption"
                              sx={(theme) => ({
                                fontSize: "0.7rem",
                                color: theme.palette.mode === "dark" ? "rgb(191, 233, 252)" : "success.dark",
                                fontWeight: 500,
                                display: "block",
                                lineHeight: 1.3,
                              })}
                            >
                              {matchedTeams[0]}
                              {matchedTeams.length > 1 && <span style={{ opacity: 0.7 }}> +{matchedTeams.length - 1} more</span>}
                            </Typography>
                            <Stack direction="row">
                              {isWeekday && (
                                <Chip
                                  label="Weekday"
                                  size="small"
                                  sx={{
                                    maxWidth: "150px",
                                    padding: "0px 10px",
                                    mt: 1,
                                    height: 14,
                                    fontSize: "0.6rem",
                                    bgcolor: "#272D60",
                                    color: "white",
                                    "& .MuiChip-label": { px: 0.5, py: 0 },
                                  }}
                                />
                              )}
                            </Stack>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                  {onDateSelect && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, textAlign: "center", fontSize: "0.7rem" }}>
                      Click the card to add a date to your schedule
                    </Typography>
                  )}
                </Box>
              ) : (
                <Box>
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      No Available Dates Found
                    </Typography>
                    <Typography variant="body2">Try narrowing your search by being more specific using fewer words.</Typography>
                    {result.debug.notes.length > 0 && (
                      <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
                        {result.debug.notes.join(" • ")}
                      </Typography>
                    )}
                  </Alert>
                </Box>
              )}

              {/* Debug Info (Collapsible) */}
              <Box>
                <Button size="small" onClick={() => setShowDebug(!showDebug)} endIcon={showDebug ? <ExpandLess /> : <ExpandMore />} sx={{ textTransform: "none" }}>
                  {showDebug ? "Hide" : "Show"} Debug Info
                </Button>
                <Collapse in={showDebug}>
                  <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: "grey.50" }}>
                    <Stack spacing={1.5}>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Parsed Tokens:
                        </Typography>
                        <Typography variant="caption" display="block">
                          {result.debug.parsedTokens.join(", ")}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Matched Clusters ({result.debug.matchedClusters.length}):
                        </Typography>
                        {result.debug.matchedClusters.map((c, i) => (
                          <Typography key={i} variant="caption" display="block">
                            • {c.gender} {c.level} {c.sport} (score: {c.confidence.toFixed(2)})
                          </Typography>
                        ))}
                      </Box>
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Cluster Dates ({result.debug.clusterDates.length}):
                        </Typography>
                        <Typography variant="caption" display="block">
                          {result.debug.clusterDates.join(", ")}
                        </Typography>
                      </Box>
                      {result.debug.excludedClusters && result.debug.excludedClusters.length > 0 && (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Excluded Teams ({result.debug.excludedClusters.length}):
                          </Typography>
                          {result.debug.excludedClusters.map((c, i) => (
                            <Typography key={i} variant="caption" display="block">
                              • {c.gender} {c.level} {c.sport} (score: {c.confidence.toFixed(2)})
                            </Typography>
                          ))}
                        </Box>
                      )}
                      {result.debug.excludedClusterDates && result.debug.excludedClusterDates.length > 0 && (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Excluded Team Dates ({result.debug.excludedClusterDates.length}):
                          </Typography>
                          <Typography variant="caption" display="block">
                            {result.debug.excludedClusterDates.slice(0, 10).join(", ")}
                            {result.debug.excludedClusterDates.length > 10 && " ..."}
                          </Typography>
                        </Box>
                      )}
                      {result.debug.excludedDays && result.debug.excludedDays.length > 0 && (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Excluded Days:
                          </Typography>
                          <Typography variant="caption" display="block">
                            {result.debug.excludedDays.join(", ")}
                          </Typography>
                        </Box>
                      )}
                      {result.debug.dateRange && (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Date Range Filter:
                          </Typography>
                          <Typography variant="caption" display="block">
                            {result.debug.dateRange.months && `Months: ${result.debug.dateRange.months.join(", ")}`}
                            {result.debug.dateRange.month && !result.debug.dateRange.months && `Month: ${result.debug.dateRange.month}`}
                            {result.debug.dateRange.start && ` Start: ${result.debug.dateRange.start}`}
                            {result.debug.dateRange.end && ` End: ${result.debug.dateRange.end}`}
                          </Typography>
                        </Box>
                      )}
                      {result.debug.minSpacing && (
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>
                            Minimum Spacing:
                          </Typography>
                          <Typography variant="caption" display="block">
                            {result.debug.minSpacing} days between dates
                          </Typography>
                        </Box>
                      )}
                      <Box>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          Notes:
                        </Typography>
                        {result.debug.notes.map((note, i) => (
                          <Typography key={i} variant="caption" display="block">
                            • {note}
                          </Typography>
                        ))}
                      </Box>
                    </Stack>
                  </Paper>
                </Collapse>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: "none", borderRadius: 2 }}>
          Close
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Search />}
          disabled={loading || !prompt.trim()}
          sx={(theme) => ({ color: theme.palette.mode === "dark" ? theme.palette.themeText.contrastText : "", textTransform: "none", borderRadius: 2 })}
        >
          {loading ? "Searching..." : "Find Dates"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
