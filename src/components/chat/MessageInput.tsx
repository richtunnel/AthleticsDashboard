"use client";

import { useState, useCallback, KeyboardEvent } from "react";
import { Box, TextField, IconButton, CircularProgress } from "@mui/material";
import { Send } from "@mui/icons-material";

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
}: MessageInputProps) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || sending || disabled) return;

    setSending(true);
    try {
      await onSend(trimmed);
      setMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  }, [message, sending, disabled, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-end",
        gap: 1,
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        size="small"
        placeholder={placeholder}
        value={message}
        onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        slotProps={{
          htmlInput: { maxLength: 2000 },
        }}
        sx={{
          "& .MuiOutlinedInput-root": {
            borderRadius: 3,
          },
        }}
      />
      <IconButton
        color="primary"
        onClick={handleSend}
        disabled={!message.trim() || sending || disabled}
        sx={{
          bgcolor: "primary.main",
          color: "white",
          "&:hover": { bgcolor: "primary.dark" },
          "&.Mui-disabled": { bgcolor: "grey.300", color: "grey.500" },
          width: 40,
          height: 40,
        }}
      >
        {sending ? <CircularProgress size={20} color="inherit" /> : <Send fontSize="small" />}
      </IconButton>
    </Box>
  );
}
