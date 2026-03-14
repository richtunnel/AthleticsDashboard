"use client";

import { useEffect, useRef } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import MessageBubble from "./MessageBubble";

interface Message {
  id: string;
  senderUserId: string;
  senderName: string;
  senderImage?: string | null;
  content: string;
  createdAt: string;
  readAt: string | null;
}

interface MessageThreadProps {
  messages: Message[];
  currentUserId: string;
}

function formatDateDivider(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

export default function MessageThread({ messages, currentUserId }: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: prevMessageCountRef.current === 0 ? "instant" : "smooth",
      });
    }
    prevMessageCountRef.current = messages.length;
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 4,
        }}
      >
        <Typography variant="body1" color="text.secondary" textAlign="center">
          No messages yet. Start the conversation!
        </Typography>
      </Box>
    );
  }

  // Group messages by date for date dividers
  let lastDate: Date | null = null;

  return (
    <Box
      ref={scrollRef}
      sx={{
        flex: 1,
        overflow: "auto",
        px: 2,
        py: 2,
      }}
    >
      {messages.map((msg) => {
        const msgDate = new Date(msg.createdAt);
        const showDateDivider = !lastDate || !isSameDay(lastDate, msgDate);
        lastDate = msgDate;

        return (
          <Box key={msg.id}>
            {showDateDivider && (
              <Divider sx={{ my: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatDateDivider(msg.createdAt)}
                </Typography>
              </Divider>
            )}
            <MessageBubble
              content={msg.content}
              createdAt={msg.createdAt}
              senderName={msg.senderName}
              senderImage={msg.senderImage}
              isCurrentUser={msg.senderUserId === currentUserId}
            />
          </Box>
        );
      })}
    </Box>
  );
}
