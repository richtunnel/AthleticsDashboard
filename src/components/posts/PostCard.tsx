"use client";

import { useState } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  Chip,
} from "@mui/material";
import { MoreHoriz, Delete, School } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";

export interface PostAuthor {
  id: string;
  name: string | null;
  image: string | null;
  schoolName: string | null;
  role: string;
}

export interface PostImageData {
  id: string;
  url: string;
  key: string;
}

export interface PostData {
  id: string;
  content: string | null;
  createdAt: string;
  author: PostAuthor;
  images: PostImageData[];
}

interface PostCardProps {
  post: PostData;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
}

const MAX_PREVIEW_LENGTH = 300;

function ImageGrid({ images }: { images: PostImageData[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  if (images.length === 0) return null;

  const gridStyles: Record<number, object> = {
    1: { gridTemplateColumns: "1fr", gridTemplateRows: "auto" },
    2: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "220px" },
    3: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "220px 220px" },
    4: { gridTemplateColumns: "1fr 1fr", gridTemplateRows: "200px 200px" },
  };

  const imgSlot = (img: PostImageData, extraStyle?: object) => (
    <Box
      key={img.id}
      onClick={() => setLightbox(img.url)}
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 1,
        cursor: "pointer",
        bgcolor: "action.hover",
        ...extraStyle,
      }}
    >
      <Image
        src={img.url}
        alt="Post image"
        fill
        sizes="(max-width: 600px) 100vw, 50vw"
        style={{ objectFit: "cover" }}
      />
    </Box>
  );

  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: 0.5,
          mt: 1.5,
          borderRadius: 2,
          overflow: "hidden",
          ...(gridStyles[images.length as keyof typeof gridStyles] || gridStyles[4]),
        }}
      >
        {images.length === 3
          ? [
              <Box key={images[0].id} sx={{ gridRow: "1 / 3", position: "relative", overflow: "hidden", cursor: "pointer", bgcolor: "action.hover", borderRadius: 1 }} onClick={() => setLightbox(images[0].url)}>
                <Image src={images[0].url} alt="Post image" fill sizes="50vw" style={{ objectFit: "cover" }} />
              </Box>,
              imgSlot(images[1]),
              imgSlot(images[2]),
            ]
          : images.map((img) => imgSlot(img))}
      </Box>

      {lightbox && (
        <Box
          onClick={() => setLightbox(null)}
          sx={{
            position: "fixed",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.9)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <Box sx={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", width: "100%", height: "100%" }}>
            <Image
              src={lightbox}
              alt="Full size"
              fill
              style={{ objectFit: "contain" }}
              sizes="90vw"
            />
          </Box>
        </Box>
      )}
    </>
  );
}

export default function PostCard({ post, currentUserId, onDelete }: PostCardProps) {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);

  const isOwn = currentUserId === post.author.id;
  const content = post.content || "";
  const isLong = content.length > MAX_PREVIEW_LENGTH;
  const displayContent = isLong && !expanded ? content.slice(0, MAX_PREVIEW_LENGTH) + "…" : content;

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const initials = (post.author.name || "AD")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card
      sx={{
        mb: 2,
        borderRadius: 3,
        boxShadow: theme.palette.mode === "dark"
          ? "0 1px 3px rgba(0,0,0,0.4)"
          : "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid",
        borderColor: "divider",
        transition: "box-shadow 0.15s",
        "&:hover": {
          boxShadow: theme.palette.mode === "dark"
            ? "0 4px 12px rgba(0,0,0,0.5)"
            : "0 4px 12px rgba(0,0,0,0.12)",
        },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5 }}>
          <Avatar
            src={post.author.image || undefined}
            sx={{
              width: 44,
              height: 44,
              bgcolor: "#1e293b",
              color: "#ffffff",
              fontSize: 15,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {initials}
          </Avatar>

          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {post.author.name || "Athletic Director"}
            </Typography>
            {post.author.schoolName && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <School sx={{ fontSize: 13, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary" noWrap>
                  {post.author.schoolName}
                </Typography>
              </Box>
            )}
            <Typography variant="caption" color="text.disabled">
              {timeAgo}
            </Typography>
          </Box>

          <Chip
            label="Athletic Director"
            size="small"
            sx={{ fontSize: 11, height: 22, display: { xs: "none", sm: "flex" } }}
          />

          {isOwn && onDelete && (
            <>
              <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                <MoreHoriz fontSize="small" />
              </IconButton>
              <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={() => setMenuAnchor(null)}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
              >
                <MenuItem
                  onClick={() => {
                    setMenuAnchor(null);
                    onDelete(post.id);
                  }}
                  sx={{ color: "error.main", gap: 1 }}
                >
                  <Delete fontSize="small" />
                  Delete post
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* Content */}
        {content && (
          <Box>
            <Typography
              variant="body2"
              sx={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                lineHeight: 1.6,
                fontSize: "0.9rem",
              }}
            >
              {displayContent}
            </Typography>
            {isLong && (
              <Typography
                component="span"
                variant="body2"
                onClick={() => setExpanded((v) => !v)}
                sx={{
                  color: "primary.main",
                  cursor: "pointer",
                  fontWeight: 600,
                  ml: 0.5,
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {expanded ? "see less" : "see more"}
              </Typography>
            )}
          </Box>
        )}

        {/* Images */}
        <ImageGrid images={post.images} />
      </CardContent>
    </Card>
  );
}
