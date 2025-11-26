"use client";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Box,
} from "@mui/material";
import { Error as ErrorIcon, CalendarToday, Timeline, Sync } from "@mui/icons-material";

interface DateRequiredModalProps {
  open: boolean;
  onClose: () => void;
}

export function DateRequiredModal({ open, onClose }: DateRequiredModalProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, color: "error.main" }}>
        <ErrorIcon />
        Date Column Required
      </DialogTitle>
      <DialogContent>
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle>Cannot Import Without Date Column</AlertTitle>
          Your spreadsheet must include a date column for the import to work properly.
        </Alert>

        <Typography variant="body1" gutterBottom>
          The date field is required because it enables critical functionality:
        </Typography>

        <List>
          <ListItem>
            <ListItemIcon>
              <CalendarToday color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Calendar Sync"
              secondary="Automatically sync games to your Google Calendar"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Timeline color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Score Tracker"
              secondary="Track and analyze game results over time"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <Sync color="primary" />
            </ListItemIcon>
            <ListItemText
              primary="Scheduling & Organization"
              secondary="Sort, filter, and manage games chronologically"
            />
          </ListItem>
        </List>

        <Box sx={{ mt: 2, p: 2, bgcolor: "grey.100", borderRadius: 1 }}>
          <Typography variant="body2" fontWeight="medium" gutterBottom>
            What to do:
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please add a date column to your spreadsheet (e.g., "Date", "Game Date", "Schedule Date") 
            and ensure each row has a valid date before importing.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">
          Got It
        </Button>
      </DialogActions>
    </Dialog>
  );
}
