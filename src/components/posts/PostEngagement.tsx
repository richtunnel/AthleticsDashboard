"use client";

import { useState } from "react";
import { Box, IconButton, Typography, Tooltip } from "@mui/material";
import { Favorite, FavoriteBorder, BookmarkBorder, Bookmark, ChatBubbleOutline } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";

export interface EngagementState {
  likeCount: number;
  saveCount: number;
  commentCount: number;
  isLiked: boolean;
  isSaved: boolean;
}

interface PostEngagementProps {
  postId: string;
  initial: EngagementState;
  onCommentToggle: () => void;
}

async function toggleLike(postId: string) {
  const res = await fetch(`/api/parent/posts/${postId}/like`, { method: "POST" });
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return json.data as { liked: boolean; likeCount: number };
}

async function toggleSave(postId: string) {
  const res = await fetch(`/api/parent/posts/${postId}/save`, { method: "POST" });
  if (!res.ok) throw new Error("Failed");
  const json = await res.json();
  return json.data as { saved: boolean; saveCount: number };
}

export default function PostEngagement({ postId, initial, onCommentToggle }: PostEngagementProps) {
  const theme = useTheme();
  const [state, setState] = useState<EngagementState>(initial);
  const [likePending, setLikePending] = useState(false);
  const [savePending, setSavePending] = useState(false);

  const handleLike = async () => {
    if (likePending) return;
    // Optimistic update
    setState((prev) => ({
      ...prev,
      isLiked: !prev.isLiked,
      likeCount: prev.isLiked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
    }));
    setLikePending(true);
    try {
      const data = await toggleLike(postId);
      setState((prev) => ({ ...prev, isLiked: data.liked, likeCount: data.likeCount }));
    } catch {
      // Revert on failure
      setState((prev) => ({
        ...prev,
        isLiked: !prev.isLiked,
        likeCount: prev.isLiked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
      }));
    } finally {
      setLikePending(false);
    }
  };

  const handleSave = async () => {
    if (savePending) return;
    setState((prev) => ({
      ...prev,
      isSaved: !prev.isSaved,
      saveCount: prev.isSaved ? Math.max(0, prev.saveCount - 1) : prev.saveCount + 1,
    }));
    setSavePending(true);
    try {
      const data = await toggleSave(postId);
      setState((prev) => ({ ...prev, isSaved: data.saved, saveCount: data.saveCount }));
    } catch {
      setState((prev) => ({
        ...prev,
        isSaved: !prev.isSaved,
        saveCount: prev.isSaved ? Math.max(0, prev.saveCount - 1) : prev.saveCount + 1,
      }));
    } finally {
      setSavePending(false);
    }
  };

  const iconSx = { fontSize: 20 };
  const countSx = {
    fontSize: "0.78rem",
    fontWeight: 600,
    color: "text.secondary",
    minWidth: 16,
    lineHeight: 1,
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        mt: 1.5,
        pt: 1.5,
        borderTop: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Like */}
      <Tooltip title={state.isLiked ? "Unlike" : "Like"} placement="top">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <IconButton
            size="small"
            onClick={handleLike}
            sx={{
              color: state.isLiked ? "error.main" : "text.secondary",
              transition: "color 0.15s, transform 0.1s",
              "&:active": { transform: "scale(0.88)" },
              p: 0.75,
            }}
            aria-label={state.isLiked ? "Unlike post" : "Like post"}
          >
            {state.isLiked ? (
              <Favorite sx={iconSx} />
            ) : (
              <FavoriteBorder sx={iconSx} />
            )}
          </IconButton>
          {state.likeCount > 0 && (
            <Typography sx={countSx}>{state.likeCount}</Typography>
          )}
        </Box>
      </Tooltip>

      {/* Comment */}
      <Tooltip title="Comment" placement="top">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <IconButton
            size="small"
            onClick={onCommentToggle}
            sx={{ color: "text.secondary", p: 0.75 }}
            aria-label="Toggle comments"
          >
            <ChatBubbleOutline sx={iconSx} />
          </IconButton>
          {state.commentCount > 0 && (
            <Typography sx={countSx}>{state.commentCount}</Typography>
          )}
        </Box>
      </Tooltip>

      {/* Spacer */}
      <Box sx={{ flexGrow: 1 }} />

      {/* Save — right-aligned like Instagram bookmarks */}
      <Tooltip title={state.isSaved ? "Unsave" : "Save post"} placement="top">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {state.saveCount > 0 && (
            <Typography sx={countSx}>{state.saveCount}</Typography>
          )}
          <IconButton
            size="small"
            onClick={handleSave}
            sx={{
              color: state.isSaved ? "primary.main" : "text.secondary",
              transition: "color 0.15s",
              p: 0.75,
            }}
            aria-label={state.isSaved ? "Unsave post" : "Save post"}
          >
            {state.isSaved ? (
              <Bookmark sx={iconSx} />
            ) : (
              <BookmarkBorder sx={iconSx} />
            )}
          </IconButton>
        </Box>
      </Tooltip>
    </Box>
  );
}
