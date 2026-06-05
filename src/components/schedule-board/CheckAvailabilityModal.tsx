"use client";

import { useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, ToggleButton, ToggleButtonGroup, Typography,
  CircularProgress, Box, Stack, Divider, TextField,
} from "@mui/material";
import SendIcon   from "@mui/icons-material/Send";
import HomeIcon   from "@mui/icons-material/Home";
import FlightIcon from "@mui/icons-material/FlightTakeoff";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications } from "@/contexts/NotificationContext";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";
import { formatGameDate, formatGameTime, sportComboLabel } from "@/lib/utils/formatGameDateTime";

interface Props {
  open:           boolean;
  onClose:        () => void;
  schedulePostId: string;
  availableDate:  string;
  timezone:       string;
  schoolName:     string | null;
  sport:          string;
  level:          string;
  gender:         string;
}

export function CheckAvailabilityModal({
  open, onClose,
  schedulePostId, availableDate,
  timezone, schoolName, sport, level, gender,
}: Props) {
  const [isHome, setIsHome]           = useState<boolean | null>(null);
  const [note, setNote]               = useState("");
  const [sendBtnRef, setSendBtnRef]   = useState<HTMLElement | null>(null);
  const queryClient                   = useQueryClient();
  const { addNotification }           = useNotifications();

  const mutation = useMutation({
    mutationFn: () =>
      fetch("/api/game-requests", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          schedulePostId,
          availableDate,
          isHomeForRequester: isHome,
          note: note.trim() || null,
        }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Failed to send request");
        return d;
      }),
    onSuccess: () => {
      addNotification("Game request sent! You'll be notified when they respond.", "success");
      queryClient.invalidateQueries({ queryKey: ["game-requests"] });
      queryClient.invalidateQueries({ queryKey: ["game-requests-unread"] });
      onClose();
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  const dateLabel  = formatGameDate(availableDate, timezone);
  const timeLabel  = formatGameTime(null, timezone); // time TBD for available dates
  const comboLabel = sportComboLabel(sport, level, gender);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
        Request a Game
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          You're requesting a <strong>{comboLabel}</strong> game with{" "}
          <strong>{schoolName || "this school"}</strong>.
        </Typography>

        {/* Date highlight */}
        <Box
          sx={{
            textAlign:    "center",
            py:           2,
            mb:           2,
            borderRadius: 2,
            bgcolor:      "action.hover",
          }}
        >
          <Typography variant="h6" fontWeight={700}>{dateLabel}</Typography>
          <Typography variant="body2" color="text.secondary">{timeLabel}</Typography>
        </Box>

        <Divider sx={{ mb: 2, borderColor: "divider", borderBottomWidth: "0.5px" }} />

        {/* Home / Away selection — required */}
        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
          Are you playing Home or Away? <span style={{ color: "red" }}>*</span>
        </Typography>

        <ToggleButtonGroup
          value={isHome === null ? null : isHome ? "home" : "away"}
          exclusive
          onChange={(_, val) => {
            if (val === "home") setIsHome(true);
            else if (val === "away") setIsHome(false);
          }}
          fullWidth
          sx={{ mb: 0.5 }}
        >
          <ToggleButton value="home" sx={{ gap: 1, textTransform: "none", fontWeight: 600 }}>
            <HomeIcon fontSize="small" /> Home
          </ToggleButton>
          <ToggleButton value="away" sx={{ gap: 1, textTransform: "none", fontWeight: 600 }}>
            <FlightIcon fontSize="small" /> Away
          </ToggleButton>
        </ToggleButtonGroup>

        {isHome === null && (
          <Typography variant="caption" color="text.disabled">
            Please select Home or Away to continue.
          </Typography>
        )}

        <Divider sx={{ my: 2, borderBottomWidth: "0.5px" }} />

        <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
          Add a note <Typography component="span" variant="caption" color="text.disabled">(optional)</Typography>
        </Typography>
        <TextField
          multiline
          rows={3}
          fullWidth
          placeholder="e.g., We're flexible on time — prefer afternoon games."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          inputProps={{ maxLength: 500 }}
          sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
        />
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5, textAlign: "right" }}>
          {note.length}/500
        </Typography>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" size="small" sx={{ textTransform: "none" }}>
          Cancel
        </Button>

        {/* TipBubble anchored to the send button — first-time explainer */}
        <Box ref={setSendBtnRef} sx={{ position: "relative" }}>
          <TipBubble
            tipId={TIP_IDS.SCHEDULE_CHECK_AVAILABILITY}
            anchorEl={sendBtnRef}
            placement="top"
            title="Request a Game from this AD"
            body="Select Home or Away, then send your request. The AD will be notified and can approve or decline. You'll see a live status update as soon as they respond — no phone tag required."
          />
          <Button
            variant="contained"
            size="small"
            disabled={isHome === null || mutation.isPending}
            onClick={() => mutation.mutate()}
            endIcon={mutation.isPending ? <CircularProgress size={14} color="inherit" /> : <SendIcon fontSize="small" />}
            sx={{
              textTransform: "none",
              fontWeight:     700,
              pl:             2,
              pr:             1.5,
              gap:            0.5,
            }}
          >
            Check Availability
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
