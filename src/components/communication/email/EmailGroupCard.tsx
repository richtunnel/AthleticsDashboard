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
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  Tooltip,
} from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import { LoadingButton } from "@/components/utils/LoadingButton";
import type { EmailGroup } from "./types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SnackbarSeverity = "success" | "info" | "warning" | "error";

interface EmailGroupCardProps {
  group: EmailGroup;
  isActive: boolean;
  isAddingEmails: boolean;
  onToggleAddEmails: () => void;
  onSelect: () => void;
  onAddEmails: (emails: string[]) => Promise<void>;
  addEmailsLoading: boolean;
  onRemoveEmail: (emailId: string) => Promise<void>;
  removeEmailLoadingId: string | null;
  onRename: (name: string) => Promise<void>;
  renameLoading: boolean;
  onDelete: () => Promise<void>;
  deleteLoading: boolean;
  onShowMessage: (message: string, severity?: SnackbarSeverity) => void;
}

export function EmailGroupCard({
  group,
  isActive,
  isAddingEmails,
  onToggleAddEmails,
  onSelect,
  onAddEmails,
  addEmailsLoading,
  onRemoveEmail,
  removeEmailLoadingId,
  onRename,
  renameLoading,
  onDelete,
  deleteLoading,
  onShowMessage,
}: EmailGroupCardProps) {
  const [emailInput, setEmailInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(group.name);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setEditValue(group.name);
  }, [group.name]);

  const emailCountLabel = useMemo(() => {
    const count = group._count.emails;
    return count === 1 ? "1 email" : `${count} emails`;
  }, [group._count.emails]);

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
      await onAddEmails(normalized);
      setEmailInput("");
      onShowMessage(`${normalized.length} email${normalized.length > 1 ? "s" : ""} added to ${group.name}`);
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
      elevation={isActive ? 6 : 1}
      sx={{
        p: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: isActive ? "primary.light" : "divider",
        background: isActive ? "rgba(33, 150, 243, 0.04)" : "background.paper",
        transition: "all 0.2s ease",
        cursor: "pointer",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: 4,
        },
      }}
      onClick={onSelect}
    >
      <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 2,
              backgroundColor: "primary.light",
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
                <TextField
                  size="small"
                  value={editValue}
                  onChange={(event) => setEditValue(event.target.value)}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                />
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
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={(event) => {
                event.stopPropagation();
                onToggleAddEmails();
              }}
            >
              {isAddingEmails ? "Close" : "Add Emails"}
            </Button>
            <Button
              size="small"
              variant="outlined"
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
              color="error"
              startIcon={<DeleteIcon />}
              onClick={(event) => {
                event.stopPropagation();
                setConfirmOpen(true);
              }}
            >
              Delete
            </Button>
          </Stack>
        )}
      </Stack>

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
            Add emails to "{group.name}"
          </Typography>
          <TextField
            multiline
            minRows={3}
            fullWidth
            placeholder="Enter emails separated by commas, spaces, or new lines"
            value={emailInput}
            onChange={(event) => setEmailInput(event.target.value)}
          />

          {inputError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {inputError}
            </Alert>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 2 }}>
            <LoadingButton
              loading={addEmailsLoading}
              onClick={handleAddEmails}
              loadingText="Saving..."
              sx={{ minWidth: 160 }}
            >
              Save Emails
            </LoadingButton>
            <Button variant="outlined" onClick={() => setEmailInput("")}
              disabled={addEmailsLoading}
            >
              Clear
            </Button>
          </Stack>
        </Box>
      )}

      {isActive && (
        <Box onClick={(event) => event.stopPropagation()}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {group._count.emails > 0 ? "Current emails" : "No emails yet"}
            </Typography>
            <Chip label={emailCountLabel} size="small" />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {group.emails.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Start adding contacts to this group to send campaigns.
            </Typography>
          ) : (
            <List dense sx={{ maxHeight: 220, overflowY: "auto" }}>
              {group.emails.map((address) => (
                <ListItem
                  key={address.id}
                  secondaryAction={
                    <Tooltip title="Remove email">
                      <span>
                        <IconButton
                          edge="end"
                          aria-label="remove"
                          onClick={() => handleRemoveEmail(address.id, address.email)}
                          disabled={removeEmailLoadingId === address.id}
                        >
                          {removeEmailLoadingId === address.id ? <CircularProgress size={18} /> : <CloseIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  }
                >
                  <ListItemText primary={address.email} />
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Delete "{group.name}"?</DialogTitle>
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
    </Paper>
  );
}
