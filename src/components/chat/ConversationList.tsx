"use client";

import {
  Box,
  Typography,
  Avatar,
  Badge,
  Paper,
  Skeleton,
} from "@mui/material";
import { Person, School } from "@mui/icons-material";
import { formatDistanceToNow } from "date-fns";

interface ConversationItem {
  id: string;
  schoolId: string;
  schoolName: string;
  // Parent variant fields
  adName?: string;
  adImage?: string | null;
  // AD variant fields
  parentName?: string;
  parentImage?: string | null;
  athleteName?: string | null;
  sport?: string | null;
  // Common
  lastMessage: {
    content: string;
    createdAt: string;
    isFromMe: boolean;
  } | null;
  unreadCount: number;
}

interface ConversationListProps {
  conversations: ConversationItem[];
  selectedId: string | null;
  onSelect: (conversation: ConversationItem) => void;
  variant: "parent" | "ad";
  isLoading?: boolean;
}

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  variant,
  isLoading = false,
}: ConversationListProps) {
  if (isLoading) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rounded" height={72} />
        ))}
      </Box>
    );
  }

  if (conversations.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 4, px: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {variant === "parent"
            ? "No conversations yet. Select a school to start chatting."
            : "No parent messages yet."}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
      {conversations.map((conv) => {
        const isSelected = selectedId === conv.id;
        const displayName =
          variant === "parent" ? conv.adName || "Athletic Director" : conv.parentName || "Parent";
        const displayImage = variant === "parent" ? conv.adImage : conv.parentImage;
        const subtitle =
          variant === "parent"
            ? conv.schoolName
            : [conv.athleteName, conv.sport].filter(Boolean).join(" · ") || conv.schoolName;

        return (
          <Paper
            key={conv.id}
            variant="outlined"
            onClick={() => onSelect(conv)}
            sx={{
              p: 1.5,
              cursor: "pointer",
              borderColor: isSelected ? "primary.main" : "divider",
              bgcolor: isSelected ? "primary.50" : "transparent",
              transition: "all 0.15s ease",
              "&:hover": {
                borderColor: "primary.main",
                bgcolor: isSelected ? "primary.50" : "action.hover",
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Badge
                badgeContent={conv.unreadCount}
                color="error"
                max={99}
              >
                <Avatar
                  src={displayImage || undefined}
                  sx={{ width: 40, height: 40, bgcolor: variant === "parent" ? "grey.300" : "primary.main" }}
                >
                  {variant === "parent" ? (
                    <School fontSize="small" />
                  ) : (
                    <Person fontSize="small" />
                  )}
                </Avatar>
              </Badge>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography
                    variant="subtitle2"
                    fontWeight={conv.unreadCount > 0 ? 700 : 600}
                    noWrap
                  >
                    {displayName}
                  </Typography>
                  {conv.lastMessage && (
                    <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0, ml: 1 }}>
                      {formatDistanceToNow(new Date(conv.lastMessage.createdAt), { addSuffix: false })}
                    </Typography>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {subtitle}
                </Typography>
                {conv.lastMessage && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    noWrap
                    sx={{
                      mt: 0.25,
                      fontWeight: conv.unreadCount > 0 ? 600 : 400,
                    }}
                  >
                    {conv.lastMessage.isFromMe ? "You: " : ""}
                    {conv.lastMessage.content}
                  </Typography>
                )}
              </Box>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
}
