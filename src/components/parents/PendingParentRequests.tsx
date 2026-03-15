"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
  Autocomplete,
  TextField,
  IconButton,
  Tooltip,
} from "@mui/material";
import { Check, Close, AutoFixHigh, SyncAlt } from "@mui/icons-material";
import { useNotifications } from "@/contexts/NotificationContext";

interface MatchSuggestion {
  columnName: string;
  columnValue: string;
  score: number;
  source: "customFields" | "team";
}

interface PendingRequest {
  id: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  sport: string;
  level: string;
  schoolName: string;
  schoolId: string;
  status: string;
  createdAt: string;
  suggestions: MatchSuggestion[];
}

interface PendingResponse {
  pendingRequests: PendingRequest[];
  importedColumns: string[];
}

interface RowMapping {
  columnName: string;
  columnValue: string;
}

async function fetchPendingRequests(): Promise<PendingResponse> {
  const res = await fetch("/api/parent-schedule-mappings/pending");
  if (!res.ok) throw new Error("Failed to fetch pending requests");
  return res.json();
}

async function fetchColumnValues(columnName: string): Promise<{ values: string[] }> {
  const res = await fetch(
    `/api/parent-schedule-mappings/column-values?columnName=${encodeURIComponent(columnName)}`
  );
  if (!res.ok) throw new Error("Failed to fetch column values");
  return res.json();
}

function getConfidenceColor(score: number): "success" | "warning" | "error" | "default" {
  if (score >= 0.8) return "success";
  if (score >= 0.6) return "warning";
  return "error";
}

function getConfidenceLabel(score: number): string {
  if (score >= 0.8) return "High";
  if (score >= 0.6) return "Medium";
  if (score > 0) return "Low";
  return "No match";
}

export function PendingParentRequests() {
  const { addNotification } = useNotifications();
  const queryClient = useQueryClient();
  const [rowMappings, setRowMappings] = useState<Record<string, RowMapping>>({});
  const [columnValuesCache, setColumnValuesCache] = useState<Record<string, string[]>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["pendingParentRequests"],
    queryFn: fetchPendingRequests,
    staleTime: 2 * 60 * 1000,
  });

  // Auto-fill row mappings from top suggestions
  useEffect(() => {
    if (!data?.pendingRequests) return;
    const newMappings: Record<string, RowMapping> = {};
    for (const req of data.pendingRequests) {
      if (rowMappings[req.id]) continue; // Don't overwrite user edits
      const topSuggestion = req.suggestions[0];
      if (topSuggestion) {
        newMappings[req.id] = {
          columnName: topSuggestion.columnName,
          columnValue: topSuggestion.columnValue,
        };
      } else {
        newMappings[req.id] = { columnName: "", columnValue: "" };
      }
    }
    if (Object.keys(newMappings).length > 0) {
      setRowMappings((prev) => ({ ...newMappings, ...prev }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.pendingRequests]);

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async ({
      parentAthleteLinkId,
      columnName,
      columnValue,
      matchScore,
    }: {
      parentAthleteLinkId: string;
      columnName: string;
      columnValue: string;
      matchScore?: number;
    }) => {
      const res = await fetch("/api/parent-schedule-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentAthleteLinkId, columnName, columnValue, matchScore }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to approve mapping");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pendingParentRequests"] });
      queryClient.invalidateQueries({ queryKey: ["connectedParents"] });
      queryClient.invalidateQueries({ queryKey: ["scheduleMappings"] });
      addNotification("Parent request approved and synced", "success");
    },
    onError: (error: Error) => {
      addNotification(error.message || "Failed to approve", "error");
    },
  });

  const handleApprove = (requestId: string, suggestions: MatchSuggestion[]) => {
    const mapping = rowMappings[requestId];
    if (!mapping?.columnName || !mapping?.columnValue) {
      addNotification("Please select a column and value mapping before approving", "warning");
      return;
    }
    const matchScore = suggestions.find(
      (s) => s.columnName === mapping.columnName && s.columnValue === mapping.columnValue
    )?.score;
    approveMutation.mutate({
      parentAthleteLinkId: requestId,
      columnName: mapping.columnName,
      columnValue: mapping.columnValue,
      matchScore,
    });
  };

  const handleApproveAll = () => {
    if (!data?.pendingRequests) return;
    const highConfidence = data.pendingRequests.filter((req) => {
      const top = req.suggestions[0];
      return top && top.score >= 0.8;
    });
    for (const req of highConfidence) {
      const mapping = rowMappings[req.id];
      if (mapping?.columnName && mapping?.columnValue) {
        approveMutation.mutate({
          parentAthleteLinkId: req.id,
          columnName: mapping.columnName,
          columnValue: mapping.columnValue,
          matchScore: req.suggestions[0]?.score,
        });
      }
    }
  };

  // Fetch column values when column name changes
  const loadColumnValues = async (columnName: string) => {
    if (!columnName || columnValuesCache[columnName]) return;
    try {
      const result = await fetchColumnValues(columnName);
      setColumnValuesCache((prev) => ({ ...prev, [columnName]: result.values }));
    } catch {
      // Silently fail - values just won't be available for autocomplete
    }
  };

  const updateRowMapping = (requestId: string, field: keyof RowMapping, value: string) => {
    setRowMappings((prev) => ({
      ...prev,
      [requestId]: {
        ...prev[requestId],
        [field]: value,
      },
    }));
    if (field === "columnName" && value) {
      loadColumnValues(value);
    }
  };

  if (isLoading) return null; // Don't show loading state for this section
  if (error) return null; // Silently fail

  const pendingRequests = data?.pendingRequests || [];
  const importedColumns = data?.importedColumns || [];

  if (pendingRequests.length === 0) return null;

  const highConfidenceCount = pendingRequests.filter(
    (req) => req.suggestions[0]?.score >= 0.8
  ).length;

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SyncAlt color="warning" />
          <Typography variant="h6">
            Pending Parent Requests
          </Typography>
          <Chip label={pendingRequests.length} size="small" color="warning" />
        </Box>
        {highConfidenceCount > 0 && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<AutoFixHigh />}
            onClick={handleApproveAll}
            disabled={approveMutation.isPending}
            sx={{ textTransform: "none" }}
          >
            Approve All High Confidence ({highConfidenceCount})
          </Button>
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        <Typography variant="body2">
          These parents have requested to connect. Match their sport/level with your schedule data, then approve to sync their dashboard with your games.
        </Typography>
      </Alert>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Parent</TableCell>
              <TableCell>Child</TableCell>
              <TableCell>Requested</TableCell>
              <TableCell sx={{ minWidth: 180 }}>Schedule Column</TableCell>
              <TableCell sx={{ minWidth: 220 }}>Schedule Value</TableCell>
              <TableCell>Confidence</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pendingRequests.map((req) => {
              const mapping = rowMappings[req.id] || { columnName: "", columnValue: "" };
              const topScore = req.suggestions[0]?.score || 0;

              return (
                <TableRow key={req.id}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Avatar sx={{ width: 28, height: 28, fontSize: 14 }}>
                        {req.parentName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {req.parentName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {req.parentEmail}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{req.childName}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{req.sport}</Typography>
                    {req.level && (
                      <Chip
                        label={req.level}
                        size="small"
                        variant="outlined"
                        sx={{ height: 18, fontSize: "0.65rem", mt: 0.5 }}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={importedColumns}
                      value={mapping.columnName}
                      onChange={(_, val) => updateRowMapping(req.id, "columnName", val || "")}
                      onInputChange={(_, val) => updateRowMapping(req.id, "columnName", val)}
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Column" variant="outlined" size="small" />
                      )}
                      sx={{ minWidth: 150 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={[
                        ...(columnValuesCache[mapping.columnName] || []),
                        ...req.suggestions
                          .filter((s) => s.columnName === mapping.columnName)
                          .map((s) => s.columnValue),
                      ].filter((v, i, a) => a.indexOf(v) === i)}
                      value={mapping.columnValue}
                      onChange={(_, val) => updateRowMapping(req.id, "columnValue", val || "")}
                      onInputChange={(_, val) => updateRowMapping(req.id, "columnValue", val)}
                      renderInput={(params) => (
                        <TextField {...params} placeholder="Value" variant="outlined" size="small" />
                      )}
                      sx={{ minWidth: 200 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getConfidenceLabel(topScore)}
                      size="small"
                      color={getConfidenceColor(topScore)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: "flex", gap: 0.5, justifyContent: "flex-end" }}>
                      <Tooltip title="Approve & Sync">
                        <IconButton
                          size="small"
                          color="success"
                          onClick={() => handleApprove(req.id, req.suggestions)}
                          disabled={approveMutation.isPending || !mapping.columnName || !mapping.columnValue}
                        >
                          {approveMutation.isPending ? (
                            <CircularProgress size={18} />
                          ) : (
                            <Check />
                          )}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
