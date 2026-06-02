"use client";

import { useState } from "react";
import {
  Box, Card, CardContent, Typography, Chip, Stack, IconButton,
  Tooltip, CircularProgress, TextField, Button, Divider,
} from "@mui/material";
import EditIcon          from "@mui/icons-material/Edit";
import SaveIcon          from "@mui/icons-material/Save";
import CloseIcon         from "@mui/icons-material/Close";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import VisibilityIcon    from "@mui/icons-material/Visibility";
import DeleteIcon        from "@mui/icons-material/Delete";
import OpenInNewIcon     from "@mui/icons-material/OpenInNew";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNotifications }            from "@/contexts/NotificationContext";
import { sportComboLabel }             from "@/lib/utils/formatGameDateTime";

interface SchedulePost {
  id:          string;
  sport:       string;
  level:       string;
  gender:      string;
  seasonStart: string;
  seasonEnd:   string;
  isActive:    boolean;
  title:       string | null;
  description: string | null;
  workbook:    { id: string; name: string };
}

interface Props {
  post: SchedulePost;
}

export function PostedScheduleCard({ post }: Props) {
  const queryClient         = useQueryClient();
  const { addNotification } = useNotifications();

  const [editing,     setEditing]     = useState(false);
  const [editTitle,   setEditTitle]   = useState(post.title   ?? "");
  const [editDesc,    setEditDesc]    = useState(post.description ?? "");

  const saveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/schedule-board/${post.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          title:       editTitle.trim() || null,
          description: editDesc.trim()  || null,
        }),
      }).then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-board-mine"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-schools"] });
      setEditing(false);
      addNotification("Post updated.", "success");
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/schedule-board/${post.id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ isActive: !post.isActive }),
      }).then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-board-mine"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-schools"] });
      addNotification(post.isActive ? "Post hidden from the board." : "Post is now live!", "success");
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/schedule-board/${post.id}`, { method: "DELETE" }).then(async (r) => {
        const d = await r.json(); if (!r.ok) throw new Error(d.error); return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schedule-board-mine"] });
      queryClient.invalidateQueries({ queryKey: ["schedule-board-schools"] });
      addNotification("Schedule post deleted.", "info");
    },
    onError: (err: Error) => addNotification(err.message, "error"),
  });

  const displayTitle = post.title || sportComboLabel(post.sport, post.level, post.gender);
  const start = new Date(post.seasonStart).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const end   = new Date(post.seasonEnd).toLocaleDateString("en-US",   { month: "short", day: "numeric", year: "numeric" });

  return (
    <Card
      elevation={0}
      sx={{
        border:      "1px solid",
        borderColor: post.isActive ? "primary.main" : "divider",
        borderRadius: 2,
        mb: 2,
        opacity: post.isActive ? 1 : 0.65,
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        {/* Header row */}
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: editing ? 2 : 0 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {displayTitle}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {start} — {end} · {post.workbook.name}
            </Typography>
            {post.description && !editing && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontSize: "0.78rem" }}>
                {post.description}
              </Typography>
            )}
          </Box>

          <Stack direction="row" gap={0.5} alignItems="center" flexShrink={0}>
            <Chip
              label={post.isActive ? "Live" : "Hidden"}
              size="small"
              color={post.isActive ? "success" : "default"}
              variant="outlined"
            />

            <Tooltip title="View on Schedule Board">
              <IconButton size="small" component="a" href="/schedule-board" target="_blank" rel="noopener noreferrer">
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <Tooltip title={editing ? "Cancel edit" : "Edit title & description"}>
              <IconButton size="small" onClick={() => { setEditing(!editing); setEditTitle(post.title ?? ""); setEditDesc(post.description ?? ""); }}>
                {editing ? <CloseIcon fontSize="small" /> : <EditIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title={post.isActive ? "Hide from board" : "Show on board"}>
              <span>
                <IconButton size="small" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate()}>
                  {toggleMutation.isPending
                    ? <CircularProgress size={14} />
                    : post.isActive ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>

            <Tooltip title="Delete post">
              <span>
                <IconButton
                  size="small" color="error"
                  disabled={deleteMutation.isPending}
                  onClick={() => { if (confirm("Delete this post? All game requests will also be removed.")) deleteMutation.mutate(); }}
                >
                  {deleteMutation.isPending ? <CircularProgress size={14} /> : <DeleteIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Inline edit form */}
        {editing && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1.5}>
              <TextField
                size="small"
                label="Post title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder={sportComboLabel(post.sport, post.level, post.gender)}
                inputProps={{ maxLength: 80 }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                size="small"
                label="Description"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="e.g. Preferred game times, travel notes, contact info…"
                multiline
                minRows={2}
                maxRows={4}
                inputProps={{ maxLength: 300 }}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <Stack direction="row" gap={1}>
                <Button
                  size="small"
                  variant="contained"
                  startIcon={saveMutation.isPending ? <CircularProgress size={12} color="inherit" /> : <SaveIcon fontSize="small" />}
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  Save
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setEditing(false)}
                  sx={{ textTransform: "none" }}
                >
                  Cancel
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </CardContent>
    </Card>
  );
}
