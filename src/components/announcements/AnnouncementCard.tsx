"use client";

import { useState } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { MoreHoriz, Delete, Edit, PushPin } from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";
import { AnnouncementComposer } from "./AnnouncementComposer";

export interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    schoolName: string | null;
  };
  organization?: { id: string; name: string };
}

interface Props {
  announcement: AnnouncementData;
  currentUserId?: string;
  onDelete?: (id: string) => void;
  onUpdated?: (updated: AnnouncementData) => void;
  /** Show school name badge — used in parent view where multiple schools may appear */
  showSchool?: boolean;
}

const MAX_PREVIEW = 400;

export function AnnouncementCard({ announcement, currentUserId, onDelete, onUpdated, showSchool }: Props) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isOwn = currentUserId === announcement.author.id;
  const isLong = announcement.content.length > MAX_PREVIEW;
  const displayContent =
    isLong && !expanded ? announcement.content.slice(0, MAX_PREVIEW) + "…" : announcement.content;

  const initials = (announcement.author.name || "AD")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const timeAgo = formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true });
  const wasEdited = announcement.updatedAt !== announcement.createdAt;

  const handleDelete = async () => {
    setMenuAnchor(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/announcements/${announcement.id}`, { method: "DELETE" });
      if (res.ok) onDelete?.(announcement.id);
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <AnnouncementComposer
        currentUser={announcement.author}
        onCreated={() => {}}
        editData={{
          id: announcement.id,
          title: announcement.title,
          content: announcement.content,
          isPinned: announcement.isPinned,
        }}
        onEditDone={async (updated?: AnnouncementData) => {
          if (updated) onUpdated?.(updated);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <Card
      sx={{
        mb: 2,
        boxShadow: "none",
        border: "1px solid",
        borderColor: announcement.isPinned ? "primary.main" : "divider",
        borderRadius: 2,
        opacity: deleting ? 0.5 : 1,
        transition: "opacity 0.2s",
      }}
    >
      <CardContent sx={{ pb: "16px !important" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5 }}>
          <Avatar
            src={announcement.author.image ?? undefined}
            sx={{ width: 36, height: 36, bgcolor: "primary.main", color: "#fff", fontSize: "0.85rem" }}
            alt={announcement.author.name ?? "Author"}
          >
            {initials}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle2" fontWeight={600} noWrap>
                {announcement.author.name || "Athletic Director"}
              </Typography>
              {announcement.author.schoolName && (
                <Chip label={announcement.author.schoolName} size="small" sx={{ height: 18, fontSize: "0.65rem" }} />
              )}
              {showSchool && announcement.organization && (
                <Chip label={announcement.organization.name} size="small" color="primary" variant="outlined" sx={{ height: 18, fontSize: "0.65rem" }} />
              )}
              {announcement.isPinned && (
                <Chip
                  icon={<PushPin sx={{ fontSize: "0.7rem !important" }} />}
                  label="Pinned"
                  size="small"
                  color="primary"
                  sx={{ height: 18, fontSize: "0.65rem" }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.disabled">
              {timeAgo}{wasEdited ? " · edited" : ""}
            </Typography>
          </Box>

          {isOwn && (onDelete || onUpdated) && (
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              aria-label="Announcement options"
              aria-haspopup="true"
            >
              <MoreHoriz fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* Title */}
        <Typography variant="h6" fontWeight={700} sx={{ fontSize: "1rem", mb: 0.75, lineHeight: 1.4 }}>
          {announcement.title}
        </Typography>

        {/* Content */}
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>
          {displayContent}
        </Typography>
        {isLong && (
          <Typography
            variant="caption"
            color="primary"
            sx={{ cursor: "pointer", fontWeight: 600, display: "block", mt: 0.5 }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "See less" : "See more"}
          </Typography>
        )}
      </CardContent>

      {/* Options menu */}
      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setMenuAnchor(null); setEditing(true); }}>
          <Edit fontSize="small" sx={{ mr: 1 }} /> Edit
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: "error.main" }}>
          <Delete fontSize="small" sx={{ mr: 1 }} /> Delete
        </MenuItem>
      </Menu>
    </Card>
  );
}
