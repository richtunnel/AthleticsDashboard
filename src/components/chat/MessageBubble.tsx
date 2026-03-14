"use client";

import { Box, Typography, Avatar } from "@mui/material";
import { Person } from "@mui/icons-material";
import { format } from "date-fns";

interface MessageBubbleProps {
  content: string;
  createdAt: string;
  senderName: string;
  senderImage?: string | null;
  isCurrentUser: boolean;
}

export default function MessageBubble({
  content,
  createdAt,
  senderName,
  senderImage,
  isCurrentUser,
}: MessageBubbleProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: isCurrentUser ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 1,
        mb: 1.5,
      }}
    >
      <Avatar
        src={senderImage || undefined}
        sx={{
          width: 32,
          height: 32,
          bgcolor: isCurrentUser ? "primary.main" : "grey.400",
        }}
      >
        <Person fontSize="small" />
      </Avatar>

      <Box sx={{ maxWidth: "70%" }}>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mb: 0.25,
            textAlign: isCurrentUser ? "right" : "left",
            color: "text.secondary",
            px: 1,
          }}
        >
          {senderName}
        </Typography>
        <Box
          sx={{
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: isCurrentUser ? "primary.main" : "grey.100",
            color: isCurrentUser ? "primary.contrastText" : "text.primary",
            borderBottomRightRadius: isCurrentUser ? 4 : 16,
            borderBottomLeftRadius: isCurrentUser ? 16 : 4,
            wordBreak: "break-word",
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {content}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 0.25,
            textAlign: isCurrentUser ? "right" : "left",
            color: "text.disabled",
            px: 1,
            fontSize: "0.7rem",
          }}
        >
          {isNaN(new Date(createdAt).getTime()) ? "" : format(new Date(createdAt), "h:mm a")}
        </Typography>
      </Box>
    </Box>
  );
}
