"use client";

import { useState } from "react";
import { Box, Typography, IconButton, Tooltip, TextField, Dialog, DialogTitle, DialogContent, DialogActions, Button, CircularProgress } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { Edit as EditIcon, Add, Delete as DeleteIcon } from "@mui/icons-material";

interface Workbook {
  id: string;
  name: string;
  sortOrder: number;
  _count?: {
    games: number;
  };
}

interface WorksheetViewProps {
  workbooks: Workbook[];
  selectedWorkbookId: string | null;
  onSelectWorkbook: (id: string) => void;
  onCreateWorkbook: () => void;
  onRenameWorkbook: (id: string, name: string) => void;
  onDeleteWorkbook: (id: string) => void;
  isCreating?: boolean;
  worksheetLimit?: number;
  /** ID of the workbook currently being deleted (shows spinner overlay on that card) */
  deletingWorkbookId?: string | null;
}

const MAX_TITLE_LENGTH = 22;

export function WorksheetView({ workbooks, selectedWorkbookId, onSelectWorkbook, onCreateWorkbook, onRenameWorkbook, onDeleteWorkbook, isCreating, worksheetLimit, deletingWorkbookId }: WorksheetViewProps) {
  const theme = useTheme();
  const [editDialog, setEditDialog] = useState<{
    open: boolean;
    workbookId: string;
    currentName: string;
  } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    workbookId: string;
    workbookName: string;
    gameCount: number;
  } | null>(null);

  const cardBg = theme.palette.mode === "dark" ? alpha(theme.palette.background.paper, 0.6) : alpha(theme.palette.grey[100], 0.8);

  const cardBorder = theme.palette.mode === "dark" ? alpha(theme.palette.divider, 0.3) : alpha(theme.palette.divider, 0.5);

  const containerBg = theme.palette.mode === "dark" ? alpha(theme.palette.background.default, 0.4) : alpha(theme.palette.grey[50], 0.6);

  return (
    <>
      <Box sx={{ display: "block", width: "100%", textAlign: "center", mt: 2 }}>
        <Typography
          variant="h5"
          sx={{ fontWeight: 700, mb: 0.5, fontSize: { xs: "1.25rem", md: "1.5rem" }, color: (theme) => (theme.palette.mode === "dark" ? theme.palette.primary.light : theme.palette.text.primary) }}
        >
          Worksheets
        </Typography>

        <Typography variant="body2" component="div" color="text.primary" sx={{ fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
          {/* Manage your athletic schedules and create your own customized columns. */}
          Create multiple isolated spreadsheets.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
          minHeight: 300,
          py: 4,
        }}
      >
        <Box
          sx={{
            bgcolor: containerBg,
            borderRadius: 4,
            p: 3,
            maxWidth: 732,
            width: "100%",
          }}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 2,
            }}
          >
            {/* Add new worksheet card */}
            <Box
              onClick={onCreateWorkbook}
              sx={{
                bgcolor: "transparent",
                borderRadius: 3,
                border: "2px dashed",
                borderColor: cardBorder,
                cursor: worksheetLimit && workbooks.length >= worksheetLimit ? "not-allowed" : "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                aspectRatio: "1 / 1",
                maxHeight: 160,
                margin: "0 auto",
                width: "100%",
                maxWidth: "320px",
                transition: "all 0.2s ease",
                opacity: isCreating || (worksheetLimit && workbooks.length >= worksheetLimit) ? 0.5 : 1,
                pointerEvents: isCreating ? "none" : "auto",
                "&:hover": {
                  borderColor: worksheetLimit && workbooks.length >= worksheetLimit ? cardBorder : theme.palette.primary.main,
                  bgcolor: worksheetLimit && workbooks.length >= worksheetLimit ? "transparent" : alpha(theme.palette.primary.main, 0.05),
                },
              }}
            >
              <Add
                sx={{
                  fontSize: 28,
                  color: "text.secondary",
                  mb: 0.5,
                }}
              />
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 500,
                  color: "text.secondary",
                  fontSize: "0.8rem",
                }}
              >
                Import New
              </Typography>
            </Box>
            {/* Existing workbook cards */}
            {workbooks.map((workbook, index) => {
              const isDeleting = deletingWorkbookId === workbook.id;
              return (
                <Box
                  key={workbook.id}
                  onClick={() => !isDeleting && onSelectWorkbook(workbook.id)}
                  sx={{
                    position: "relative",
                    bgcolor: cardBg,
                    borderRadius: 3,
                    border: "1px solid",
                    borderColor: selectedWorkbookId === workbook.id ? theme.palette.primary.main : cardBorder,
                    cursor: isDeleting ? "default" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    aspectRatio: "1 / 1",
                    maxHeight: 160,
                    margin: "0 auto",
                    width: "100%",
                    maxWidth: "320px",
                    transition: "all 0.2s ease",
                    pointerEvents: isDeleting ? "none" : "auto",
                    "&:hover": isDeleting ? {} : {
                      borderColor: theme.palette.primary.main,
                      transform: "translateY(-2px)",
                      boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.15)}`,
                      "& .card-actions": {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  {/* Deleting overlay with spinner */}
                  {isDeleting && (
                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 3,
                        bgcolor: alpha(theme.palette.background.paper, 0.75),
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        zIndex: 1,
                      }}
                    >
                      <CircularProgress size={28} color="error" />
                      <Typography variant="caption" color="error" sx={{ fontSize: "0.7rem" }}>
                        Deleting…
                      </Typography>
                    </Box>
                  )}

                  {/* Edit/Delete actions */}
                  <Box
                    sx={{
                      position: "absolute",
                      top: 6,
                      right: 6,
                      display: "flex",
                      gap: 0.25,
                      opacity: 0,
                      transition: "opacity 0.2s",
                    }}
                    className="card-actions"
                  >
                    <Tooltip title="Rename">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditDialog({
                            open: true,
                            workbookId: workbook.id,
                            currentName: workbook.name,
                          });
                        }}
                        sx={{ p: 0.25 }}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete worksheet">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm({
                            workbookId: workbook.id,
                            workbookName: workbook.name,
                            gameCount: workbook._count?.games ?? 0,
                          });
                        }}
                        sx={{ p: 0.25, color: "error.main" }}
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>

                  <Typography
                    variant="h4"
                    sx={{
                      fontWeight: 500,
                      color: "text.secondary",
                      fontSize: "0.85rem",
                      textAlign: "center",
                      px: 1.5,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: "100%",
                    }}
                  >
                    {workbook.name}
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: "text.disabled",
                      mt: 0.5,
                      fontSize: "0.7rem",
                    }}
                  >
                    #{index + 1}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ color: "error.main" }}>Delete Worksheet?</DialogTitle>
          <DialogContent>
            <Typography variant="body1">
              Are you sure you want to delete <strong>&quot;{deleteConfirm?.workbookName}&quot;</strong>?
            </Typography>
            {(deleteConfirm?.gameCount ?? 0) > 0 && (
              <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                This will permanently delete{" "}
                <strong>
                  {deleteConfirm?.gameCount} game{deleteConfirm?.gameCount !== 1 ? "s" : ""}
                </strong>{" "}
                and cannot be undone.
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              color="error"
              variant="contained"
              onClick={() => {
                if (deleteConfirm) {
                  onDeleteWorkbook(deleteConfirm.workbookId);
                  setDeleteConfirm(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogActions>
        </Dialog>

        {/* Rename Dialog */}
        <Dialog open={editDialog?.open ?? false} onClose={() => setEditDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Rename Worksheet</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              fullWidth
              label="Worksheet Name"
              defaultValue={editDialog?.currentName}
              variant="outlined"
              sx={{ mt: 2 }}
              inputProps={{ maxLength: MAX_TITLE_LENGTH }}
              helperText={`${editDialog?.currentName?.length ?? 0}/${MAX_TITLE_LENGTH} characters`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (editDialog?.currentName.trim()) {
                    onRenameWorkbook(editDialog.workbookId, editDialog.currentName.trim().slice(0, MAX_TITLE_LENGTH));
                    setEditDialog(null);
                  }
                }
              }}
              onChange={(e) => {
                if (editDialog) {
                  setEditDialog({
                    ...editDialog,
                    currentName: e.target.value,
                  });
                }
              }}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (editDialog?.currentName.trim()) {
                  onRenameWorkbook(editDialog.workbookId, editDialog.currentName.trim().slice(0, MAX_TITLE_LENGTH));
                  setEditDialog(null);
                }
              }}
              variant="contained"
              disabled={!editDialog?.currentName.trim()}
            >
              Rename
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </>
  );
}
