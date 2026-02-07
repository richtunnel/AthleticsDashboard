"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Box, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography, CircularProgress, Alert } from "@mui/material";
import { Close as CloseIcon, Send as SendIcon } from "@mui/icons-material";

interface EmailComposerProps {
  gameId?: string;
  onClose: () => void;
}

export function EmailComposer({ gameId, onClose }: EmailComposerProps) {
  const [to, setTo] = useState<string>("");
  const [cc, setCc] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = gameId ? `/api/email/game/${gameId}` : "/api/email/send";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to send email");
      return res.json();
    },
    onSuccess: () => {
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const emailData = gameId
      ? { recipients: to.split(",").map((e) => e.trim()) }
      : {
          to: to.split(",").map((e) => e.trim()),
          cc: cc ? cc.split(",").map((e) => e.trim()) : [],
          subject,
          body,
          gameId: gameId || null,
        };

    mutation.mutate(emailData);
  };

  return (
    <Dialog open fullWidth maxWidth="md" onClose={onClose} PaperProps={{ sx: { borderRadius: 2 } }}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Send Email
        </Typography>
        <Button onClick={onClose} sx={{ minWidth: "auto", p: 1 }}>
          <CloseIcon />
        </Button>
      </DialogTitle>

      <form onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <TextField
              label="To (comma separated)"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@example.com, another@example.com"
              fullWidth
              required
            />

            {!gameId && (
              <>
                <TextField label="CC (optional)" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="email@example.com" fullWidth />

                <TextField label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} fullWidth required />

                <TextField label="Message" value={body} onChange={(e) => setBody(e.target.value)} fullWidth multiline rows={8} required />
              </>
            )}

            {gameId && (
              <Typography variant="body2" color="text.secondary">
                Game details will be automatically included in the email.
              </Typography>
            )}

            {mutation.isError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                Failed to send email. Please try again.
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" startIcon={mutation.isPending ? <CircularProgress size={20} /> : <SendIcon />} disabled={mutation.isPending}>
            {mutation.isPending ? "Sending..." : "Send Email"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
