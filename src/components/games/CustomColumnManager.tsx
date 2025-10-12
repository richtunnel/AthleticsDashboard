"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, List, ListItem, ListItemText, IconButton, Typography, Box, Alert, Chip, Stack } from "@mui/material";
import { Add, Delete, ViewColumn, Close } from "@mui/icons-material";
import { LoadingButton } from "@/components/utils/LoadingButton";

interface CustomColumnManagerProps {
  open: boolean;
  onClose: () => void;
}

export function CustomColumnManager({ open, onClose }: CustomColumnManagerProps) {
  const queryClient = useQueryClient();
  const [newColumnName, setNewColumnName] = useState("");
  const [error, setError] = useState("");

  // Fetch custom columns
  const { data: columnsResponse, isLoading } = useQuery({
    queryKey: ["customColumns"],
    queryFn: async () => {
      const res = await fetch("/api/organizations/custom-columns");
      if (!res.ok) throw new Error("Failed to fetch custom columns");
      return res.json();
    },
    enabled: open,
  });

  const customColumns = (columnsResponse?.data || []) as any[];

  // Create column mutation
  const createColumnMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await fetch("/api/organizations/custom-columns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create column");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customColumns"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
      setNewColumnName("");
      setError("");
    },
    onError: (error: any) => {
      setError(error.message);
    },
  });

  // Delete column mutation
  const deleteColumnMutation = useMutation({
    mutationFn: async (columnId: string) => {
      const res = await fetch(`/api/organizations/custom-columns?id=${columnId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete column");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customColumns"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });

  const handleAddColumn = () => {
    if (!newColumnName.trim()) {
      setError("Column name cannot be empty");
      return;
    }

    if (newColumnName.length > 50) {
      setError("Column name must be less than 50 characters");
      return;
    }

    createColumnMutation.mutate(newColumnName.trim());
  };

  const handleDeleteColumn = (columnId: string) => {
    if (confirm("Are you sure? This will delete all data in this column from all games.")) {
      deleteColumnMutation.mutate(columnId);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <ViewColumn />
            <Typography variant="h6">Manage Custom Columns</Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3}>
          {/* Info */}
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Create custom columns to track additional information for your games.
            </Typography>
            <Typography variant="caption">{customColumns.length} of 50 columns used</Typography>
          </Alert>

          {/* Add new column */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Add New Column
            </Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                fullWidth
                size="small"
                placeholder="Enter column name (e.g., Bus Count, Meal Budget)"
                value={newColumnName}
                onChange={(e) => {
                  setNewColumnName(e.target.value);
                  setError("");
                }}
                error={!!error}
                helperText={error}
                disabled={customColumns.length >= 50 || createColumnMutation.isPending}
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    handleAddColumn();
                  }
                }}
              />
              <LoadingButton
                variant="contained"
                startIcon={<Add />}
                onClick={handleAddColumn}
                loading={createColumnMutation.isPending}
                disabled={customColumns.length >= 50 || !newColumnName.trim()}
                sx={{ minWidth: 100 }}
              >
                Add
              </LoadingButton>
            </Stack>
          </Box>

          {/* Existing columns */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Existing Columns ({customColumns.length})
            </Typography>

            {customColumns.length === 0 ? (
              <Box
                sx={{
                  p: 3,
                  textAlign: "center",
                  border: "2px dashed",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  No custom columns yet. Add one above to get started.
                </Typography>
              </Box>
            ) : (
              <List sx={{ maxHeight: 300, overflow: "auto", border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                {customColumns.map((column: any) => (
                  <ListItem
                    key={column.id}
                    secondaryAction={
                      <IconButton edge="end" color="error" onClick={() => handleDeleteColumn(column.id)} disabled={deleteColumnMutation.isPending}>
                        <Delete />
                      </IconButton>
                    }
                    sx={{
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      "&:last-child": { borderBottom: "none" },
                    }}
                  >
                    <ListItemText primary={column.name} secondary={`Created ${new Date(column.createdAt).toLocaleDateString()}`} />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>

          {customColumns.length >= 50 && <Alert severity="warning">You've reached the maximum of 50 custom columns. Delete some columns to add new ones.</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
