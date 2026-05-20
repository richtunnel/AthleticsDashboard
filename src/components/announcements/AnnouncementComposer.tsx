"use client";

import { useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { PushPin } from "@mui/icons-material";

interface Props {
  currentUser: { id: string; name: string | null; image: string | null };
  onCreated: () => void;
  /** When provided, renders in edit mode pre-filled with existing data */
  editData?: { id: string; title: string; content: string; isPinned: boolean };
  onEditDone?: (updated?: import("./AnnouncementCard").AnnouncementData) => void;
}

export function AnnouncementComposer({ currentUser, onCreated, editData, onEditDone }: Props) {
  const isEdit = Boolean(editData);
  const [title, setTitle] = useState(editData?.title ?? "");
  const [content, setContent] = useState(editData?.content ?? "");
  const [isPinned, setIsPinned] = useState(editData?.isPinned ?? false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = (currentUser.name || "AD")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const reset = () => {
    setTitle("");
    setContent("");
    setIsPinned(false);
    setError(null);
  };

  const handleSubmit = async () => {
    const t = title.trim();
    const c = content.trim();
    if (!t) { setError("Title is required."); return; }
    if (t.length > 150) { setError("Title cannot exceed 150 characters."); return; }
    if (!c) { setError("Content is required."); return; }
    if (c.length > 5000) { setError("Content cannot exceed 5000 characters."); return; }

    setSubmitting(true);
    setError(null);

    try {
      const url = isEdit ? `/api/announcements/${editData!.id}` : "/api/announcements";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: t, content: c, isPinned }),
      });
      const responseData = await res.json();
      if (!res.ok) {
        throw new Error(responseData.error || "Failed to save announcement.");
      }
      if (isEdit) {
        onEditDone?.(responseData.data);
      } else {
        reset();
        onCreated();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card sx={{ mb: 3, boxShadow: "none", border: "1px solid", borderColor: "divider" }}>
      <CardContent sx={{ pb: "16px !important" }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Avatar
            src={currentUser.image ?? undefined}
            sx={{ width: 36, height: 36, bgcolor: "primary.main", color: "#fff", fontSize: "0.85rem", mt: 0.5 }}
            alt={currentUser.name ?? "User"}
          >
            {initials}
          </Avatar>

          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <TextField
              fullWidth
              label="Title"
              placeholder="Announcement title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              inputProps={{ maxLength: 150, "aria-label": "Announcement title" }}
              size="small"
            />
            <TextField
              fullWidth
              multiline
              minRows={3}
              maxRows={10}
              label="Message"
              placeholder="Write your announcement…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
              inputProps={{ maxLength: 5000, "aria-label": "Announcement content" }}
            />

            {content.length > 4000 && (
              <Typography variant="caption" color={content.length > 5000 ? "error" : "text.secondary"} sx={{ alignSelf: "flex-end" }}>
                {content.length} / 5000
              </Typography>
            )}

            {error && (
              <Alert severity="error" onClose={() => setError(null)} sx={{ py: 0.5 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
              <FormControlLabel
                control={
                  <Switch
                    size="small"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                    disabled={submitting}
                    icon={<PushPin sx={{ fontSize: 16 }} />}
                    checkedIcon={<PushPin sx={{ fontSize: 16 }} />}
                  />
                }
                label={<Typography variant="caption" color="text.secondary">Pin to top</Typography>}
              />

              <Box sx={{ display: "flex", gap: 1 }}>
                {isEdit && (
                  <Button size="small" onClick={() => onEditDone?.()} disabled={submitting} color="inherit">
                    Cancel
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleSubmit}
                  disabled={submitting || !title.trim() || !content.trim()}
                  startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
                >
                  {isEdit ? "Save" : "Post Announcement"}
                </Button>
              </Box>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
