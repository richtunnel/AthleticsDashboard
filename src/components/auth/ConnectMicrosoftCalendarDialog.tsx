"use client";

import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, List, ListItem, ListItemIcon, ListItemText, Alert, CircularProgress } from "@mui/material";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import LockIcon from "@mui/icons-material/Lock";
import { useState } from "react";
import { useMicrosoftCalendarConnection } from "@/hooks/useMicrosoftCalendarConnection";

interface ConnectMicrosoftCalendarDialogProps {
  open: boolean;
  onClose: () => void;
  returnTo?: string;
}

/**
 * Dialog that explains Microsoft Calendar permissions before initiating OAuth
 *
 * Shows:
 * - What permissions are being requested
 * - Why the app needs these permissions
 * - Privacy and security information
 */
export function ConnectMicrosoftCalendarDialog({ open, onClose, returnTo }: ConnectMicrosoftCalendarDialogProps) {
  const { connect } = useMicrosoftCalendarConnection();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);
      await connect(returnTo);
      // User will be redirected to Microsoft, so dialog will unmount
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    if (!isConnecting) {
      onClose();
      setError(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxWidth: "768px",
        },
      }}
    >
      <DialogTitle
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          pb: 1,
        }}
      >
        <CalendarTodayIcon color="primary" />
        <Typography variant="h6">Connect Microsoft Outlook Calendar</Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="body1" paragraph>
          To sync your games with Microsoft Outlook Calendar, we need your permission to access your calendar.
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom fontWeight="600">
            This allows us to:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleOutlineIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Create calendar events for your scheduled games" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleOutlineIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="List your calendars to choose where to sync events" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleOutlineIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Update events when game details change" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleOutlineIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Remove events when games are deleted" />
            </ListItem>
            <ListItem>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <CheckCircleOutlineIcon fontSize="small" color="success" />
              </ListItemIcon>
              <ListItemText primary="Keep your calendar automatically in sync" />
            </ListItem>
          </List>
        </Box>

        <Alert severity="info" icon={<LockIcon />} sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Your privacy matters:</strong> Your calendar data is never shared with third parties. You can disconnect at any time from your Calendar Sync page.
          </Typography>
        </Alert>

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <Typography variant="caption" color="text.secondary" display="block">
          By clicking "Connect", you'll be redirected to Microsoft to grant permissions. You can revoke access anytime from your Microsoft Account settings.
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, fontStyle: 'italic' }}>
          Read-only access is used only to list calendars so we know where to sync events.
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isConnecting} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleConnect} variant="contained" disabled={isConnecting} startIcon={isConnecting ? <CircularProgress size={16} /> : <CalendarTodayIcon />}>
          {isConnecting ? "Connecting..." : "Connect Microsoft Calendar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
