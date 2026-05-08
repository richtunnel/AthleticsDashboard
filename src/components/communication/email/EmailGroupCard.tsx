"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
  Tooltip,
  Collapse,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import { LoadingButton } from "@/components/utils/LoadingButton";
import { BulkImportModal } from "./BulkImportModal";
import type { EmailGroup, AddEmailsResponse } from "./types";
import { useTheme as customTheme } from "@mui/material/styles";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_VISIBLE_EMAILS = 3;

type SnackbarSeverity = "success" | "info" | "warning" | "error";

interface EmailGroupCardProps {
  group: EmailGroup;
  isActive: boolean;
  isAddingEmails: boolean;
  onToggleAddEmails: () => void;
  onSelect: () => void;
  onAddEmails: (emails: string[]) => Promise<AddEmailsResponse>;
  addEmailsLoading: boolean;
  onUpdateEmail: (emailId: string, email: string) => Promise<void>;
  updateEmailLoadingId: string | null;
  onRemoveEmail: (emailId: string) => Promise<void>;
  removeEmailLoadingId: string | null;
  onRename: (name: string) => Promise<void>;
  renameLoading: boolean;
  onDelete: () => Promise<void>;
  deleteLoading: boolean;
  onShowMessage: (message: string, severity?: SnackbarSeverity) => void;
  onImportSuccess?: () => void;
}

export function EmailGroupCard({
  group,
  isActive,
  isAddingEmails,
  onToggleAddEmails,
  onSelect,
  onAddEmails,
  addEmailsLoading,
  onUpdateEmail,
  updateEmailLoadingId,
  onRemoveEmail,
  removeEmailLoadingId,
  onRename,
  renameLoading,
  onDelete,
  deleteLoading,
  onShowMessage,
  onImportSuccess,
}: EmailGroupCardProps) {
  const [emailInput, setEmailInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(group.name);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Email list is hidden by default — user must click to reveal
  const [showEmailsList, setShowEmailsList] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const theme = customTheme();

  useEffect(() => {
    setEditValue(group.name);
  }, [group.name]);

  useEffect(() => {
    // When user searches, auto-reveal the email list
    if (searchQuery) {
      setShowEmailsList(true);
    }
  }, [searchQuery]);

  const emailCountLabel = useMemo(() => {
    const count = group._count.emails;
    return count === 1 ? "1 email" : `${count} emails`;
  }, [group._count.emails]);

  const filteredEmails = useMemo(() => {
    if (!searchQuery.trim()) {
      return group.emails;
    }
    const query = searchQuery.toLowerCase();
    return group.emails.filter((address) => address.email.toLowerCase().includes(query));
  }, [group.emails, searchQuery]);

  // When visible, always show all emails at once (no "3 by default" truncation)
  const displayedEmails = filteredEmails;

  const handleAddEmails = async () => {
    const parsed = emailInput
      .split(/[\s,;\n]+/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (parsed.length === 0) {
      setInputError("Enter at least one email address");
      return;
    }

    const normalized = Array.from(new Set(parsed.map((email) => email.toLowerCase())));
    const invalidEmails = normalized.filter((email) => !EMAIL_REGEX.test(email));

    if (invalidEmails.length > 0) {
      setInputError(`Invalid email${invalidEmails.length > 1 ? "s" : ""}: ${invalidEmails.join(", ")}`);
      return;
    }

    setInputError(null);

    try {
      const result = await onAddEmails(normalized);
      setEmailInput("");

      // Handle response with duplicate detection
      const addedCount = result.addedCount;
      const duplicateCount = result.duplicateCount;

      if (typeof addedCount === "number" && typeof duplicateCount === "number") {
        if (addedCount > 0 && duplicateCount > 0) {
          onShowMessage(`${addedCount} email${addedCount > 1 ? "s" : ""} added. ${duplicateCount} duplicate${duplicateCount > 1 ? "s were" : " was"} not saved (already in group).`, "warning");
        } else if (addedCount > 0 && duplicateCount === 0) {
          onShowMessage(`${addedCount} email${addedCount > 1 ? "s" : ""} added to ${group.name}`);
        } else if (addedCount === 0 && duplicateCount > 0) {
          onShowMessage(`No emails added. All ${duplicateCount} email${duplicateCount > 1 ? "s are" : " is"} already in this group.`, "warning");
        }
      } else {
        // Fallback for old response format
        onShowMessage(`${normalized.length} email${normalized.length > 1 ? "s" : ""} added to ${group.name}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        setInputError(error.message);
        onShowMessage(error.message, "error");
      }
    }
  };

  const handleRename = async () => {
    const trimmed = editValue.trim();

    if (!trimmed) {
      onShowMessage("Group name cannot be empty", "error");
      return;
    }

    if (trimmed === group.name) {
      setIsEditing(false);
      return;
    }

    try {
      await onRename(trimmed);
      setIsEditing(false);
      onShowMessage(`Group renamed to "${trimmed}"`);
    } catch {
      // Error feedback handled by parent mutation hook
    }
  };

  const handleDelete = async () => {
    try {
      await onDelete();
      setConfirmOpen(false);
      onShowMessage(`Deleted group "${group.name}"`, "success");
    } catch {
      // Keep dialog open; error feedback handled upstream
    }
  };

  const handleUpdateEmail = async (emailId: string, currentEmail: string) => {
    const trimmedEmail = editingEmailValue.trim().toLowerCase();

    if (!trimmedEmail) {
      onShowMessage("Email cannot be empty", "error");
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      onShowMessage("Invalid email format", "error");
      return;
    }

    if (trimmedEmail === currentEmail.toLowerCase()) {
      setEditingEmailId(null);
      setEditingEmailValue("");
      return;
    }

    try {
      await onUpdateEmail(emailId, trimmedEmail);
      setEditingEmailId(null);
      setEditingEmailValue("");
      onShowMessage(`Updated email to ${trimmedEmail}`);
    } catch (error) {
      if (error instanceof Error) {
        onShowMessage(error.message, "error");
      }
    }
  };

  const handleRemoveEmail = async (emailId: string, email: string) => {
    try {
      await onRemoveEmail(emailId);
      onShowMessage(`Removed ${email}`);
    } catch (error) {
      if (error instanceof Error) {
        onShowMessage(error.message, "error");
      }
    }
  };

  return (
    <Paper
      elevation={isExpanded ? 6 : 1}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: isExpanded ? "primary.light" : "divider",
        background: isExpanded ? "rgba(33, 150, 243, 0.04)" : "background.paper",
        transition: "all 0.2s ease",
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: isExpanded ? 2 : 0, cursor: "pointer" }} onClick={() => setIsExpanded(!isExpanded)}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: theme.palette.mode === "dark" ? "#545557" : "primary.light",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "primary.contrastText",
            }}
          >
            <EmailIcon />
          </Box>

          <Box>
            {isEditing ? (
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField size="small" value={editValue} onChange={(event) => setEditValue(event.target.value)} autoFocus onClick={(event) => event.stopPropagation()} />
                <IconButton
                  color="primary"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleRename();
                  }}
                  disabled={renameLoading}
                >
                  {renameLoading ? <CircularProgress size={20} /> : <CheckIcon fontSize="small" />}
                </IconButton>
                <IconButton
                  color="inherit"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsEditing(false);
                    setEditValue(group.name);
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            ) : (
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {group.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {emailCountLabel}
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>

        {!isEditing && (
          <Stack direction="row" spacing={1} alignItems="center">
            {isExpanded && (
              <>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<AddIcon />}
                  sx={(theme) => ({ color: theme.palette.mode === "dark" ? theme.palette.themeButtonText.main : "" })}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleAddEmails();
                  }}
                >
                  {isAddingEmails ? "Close" : "Add Emails"}
                </Button>
                <Tooltip title="Bulk import emails from CSV or paste">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FileUploadIcon />}
                    sx={(theme) => ({
                      borderColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                      color: theme.palette.text.primary,
                    })}
                    onClick={(event) => {
                      event.stopPropagation();
                      setImportModalOpen(true);
                    }}
                  >
                    Import
                  </Button>
                </Tooltip>
                <Button
                  size="small"
                  variant="outlined"
                  sx={(theme) => ({
                    borderColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                    color: theme.palette.text.primary,
                  })}
                  startIcon={<EditIcon />}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsEditing(true);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  sx={(theme) => ({
                    borderColor: theme.palette.mode === "dark" ? theme.palette.themeText.text : "",
                    color: theme.palette.text.primary,
                  })}
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={(event) => {
                    event.stopPropagation();
                    setConfirmOpen(true);
                  }}
                >
                  Delete
                </Button>
              </>
            )}
            <IconButton
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              sx={{
                transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.3s ease",
              }}
            >
              <ExpandMoreIcon />
            </IconButton>
          </Stack>
        )}
      </Stack>

      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        {isAddingEmails && (
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              backgroundColor: "background.default",
              border: "1px dashed",
              borderColor: "primary.light",
              mb: 3,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              Add emails to &quot;{group.name}&quot;
            </Typography>
            <TextField
              placeholder="Enter emails separated by commas, spaces, or new lines"
              value={emailInput}
              onChange={(event) => setEmailInput(event.target.value)}
              multiline
              minRows={3}
              fullWidth
            />

            {inputError && (
              <Alert severity="error" sx={{ mt: 1 }}>
                {inputError}
              </Alert>
            )}

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
              <LoadingButton loading={addEmailsLoading} onClick={handleAddEmails} loadingText="Saving..." sx={{ minWidth: 160 }}>
                Save Emails
              </LoadingButton>
              <Button variant="outlined" onClick={() => setEmailInput("")} disabled={addEmailsLoading}>
                Clear
              </Button>
            </Stack>
          </Box>
        )}

        <Box onClick={(event) => event.stopPropagation()}>
          {/* Emails toggle header — hidden by default, click to reveal */}
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              cursor: group.emails.length > 0 ? "pointer" : "default",
              userSelect: "none",
              py: 0.5,
              "&:hover": group.emails.length > 0 ? { opacity: 0.8 } : {},
            }}
            onClick={(e) => {
              if (group.emails.length > 0) {
                e.stopPropagation();
                setShowEmailsList((prev) => !prev);
                // Clear search when hiding the list
                if (showEmailsList) setSearchQuery("");
              }
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {group._count.emails > 0 ? "Emails" : "No emails yet"}
            </Typography>
            {group.emails.length > 0 && (
              <>
                <Chip label={emailCountLabel} size="small" />
                <IconButton
                  size="small"
                  tabIndex={-1}
                  sx={{
                    p: 0.25,
                    transform: showEmailsList ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.25s ease",
                    pointerEvents: "none",
                  }}
                >
                  <ExpandMoreIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Stack>

          <Divider sx={{ mt: 1, mb: 0 }} />

          <Collapse in={showEmailsList} timeout="auto" unmountOnExit>
            <Box sx={{ pt: 2 }}>
              {group.emails.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Start adding contacts to this group to send campaigns.
                </Typography>
              ) : (
                <>
                  {/* Search — only when there are enough emails to warrant it */}
                  {group.emails.length > DEFAULT_VISIBLE_EMAILS && (
                    <TextField
                      size="small"
                      placeholder="Search emails..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      fullWidth
                      sx={{ mb: 2 }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon fontSize="small" />
                          </InputAdornment>
                        ),
                        endAdornment: searchQuery && (
                          <InputAdornment position="end">
                            <IconButton size="small" onClick={() => setSearchQuery("")} edge="end">
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}

                  {filteredEmails.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      No emails found matching &quot;{searchQuery}&quot;
                    </Typography>
                  ) : (
                    <>
                      <Box sx={{ maxHeight: 300, overflowY: "auto" }}>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                          {displayedEmails.map((address) => (
                            <Chip
                              key={address.id}
                              label={
                                editingEmailId === address.id ? (
                                  <TextField
                                    size="small"
                                    value={editingEmailValue}
                                    onChange={(e) => setEditingEmailValue(e.target.value)}
                                    autoFocus
                                    sx={{
                                      minWidth: 200,
                                      "& .MuiInputBase-root": { height: 32, fontSize: "0.875rem" },
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  address.email
                                )
                              }
                              onDelete={editingEmailId === address.id ? undefined : () => handleRemoveEmail(address.id, address.email)}
                              deleteIcon={
                                removeEmailLoadingId === address.id
                                  ? <CircularProgress size={18} />
                                  : editingEmailId === address.id
                                    ? undefined
                                    : <CloseIcon fontSize="small" />
                              }
                              onClick={() => {
                                if (editingEmailId !== address.id && updateEmailLoadingId === null) {
                                  setEditingEmailId(address.id);
                                  setEditingEmailValue(address.email);
                                }
                              }}
                              sx={{
                                cursor: editingEmailId === address.id ? "default" : "pointer",
                                backgroundColor: editingEmailId === address.id ? "primary.light" : "default",
                              }}
                              disabled={
                                removeEmailLoadingId === address.id ||
                                (updateEmailLoadingId !== null && updateEmailLoadingId !== address.id)
                              }
                            />
                          ))}

                          {/* Inline save/cancel when editing an email */}
                          {editingEmailId && (
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => {
                                  const address = group.emails.find((e) => e.id === editingEmailId);
                                  if (address) handleUpdateEmail(address.id, address.email);
                                }}
                                disabled={updateEmailLoadingId === editingEmailId}
                              >
                                {updateEmailLoadingId === editingEmailId ? <CircularProgress size={18} /> : <CheckIcon fontSize="small" />}
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => { setEditingEmailId(null); setEditingEmailValue(""); }}
                                disabled={updateEmailLoadingId === editingEmailId}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          )}
                        </Box>
                      </Box>

                      {/* Search result count */}
                      {searchQuery && filteredEmails.length > 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          Showing {filteredEmails.length} of {group.emails.length} emails
                        </Typography>
                      )}

                      {/* Collapse list button */}
                      <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
                        <Button
                          size="small"
                          onClick={(e) => { e.stopPropagation(); setShowEmailsList(false); setSearchQuery(""); }}
                          startIcon={<ExpandMoreIcon sx={{ transform: "rotate(180deg)" }} />}
                        >
                          Hide emails
                        </Button>
                      </Box>
                    </>
                  )}
                </>
              )}
            </Box>
          </Collapse>
        </Box>
      </Collapse>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete &quot;{group.name}&quot;?</DialogTitle>
        <DialogContent>
          <Typography>Deleting this group will remove all stored email addresses. This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={deleteLoading}>
            Cancel
          </Button>
          <LoadingButton color="error" loading={deleteLoading} onClick={handleDelete}>
            Delete Group
          </LoadingButton>
        </DialogActions>
      </Dialog>

      <BulkImportModal
        open={importModalOpen}
        groupId={group.id}
        groupName={group.name}
        onClose={() => setImportModalOpen(false)}
        onSuccess={() => {
          setImportModalOpen(false);
          onShowMessage(`Emails imported into "${group.name}" successfully`, "success");
          onImportSuccess?.();
        }}
      />
    </Paper>
  );
}
