"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Typography, Stack, Avatar, TextField, Button, IconButton, Paper, Divider, CircularProgress, Alert, Chip, Tooltip, Menu, MenuItem, InputAdornment, Badge } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ChatIcon from "@mui/icons-material/Chat";
import SearchIcon from "@mui/icons-material/Search";
import SendIcon from "@mui/icons-material/Send";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import BlockIcon from "@mui/icons-material/Block";
import LockIcon from "@mui/icons-material/Lock";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useAdChatSSE } from "@/hooks/useAdChatSSE";
import { formatDistanceToNow } from "date-fns";

// ── Types ──────────────────────────────────────────────────────────────────

interface OtherUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  schoolName: string | null;
}

interface Conversation {
  id: string;
  otherUser: OtherUser;
  initiatorId: string;
  status: "PENDING" | "ACTIVE" | "BLOCKED" | "DO_NOT_DISTURB";
  lastMessage: { content: string; createdAt: string; isFromMe: boolean } | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Message {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderImage?: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface SearchUser {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
  schoolName: string | null;
  teamName?: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string | null, email: string) {
  const src = name || email;
  return src
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function relativeTime(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return "";
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function MessageBubble({ message, isMe, onDelete }: { message: Message; isMe: boolean; onDelete: (id: string) => void }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: isMe ? "flex-end" : "flex-start",
        mb: 0.75,
        "&:hover .msg-actions": { opacity: 1 },
      }}
    >
      {!isMe && (
        <Avatar src={message.senderImage ?? undefined} sx={{ width: 28, height: 28, mr: 1, mt: 0.25, fontSize: "0.7rem", flexShrink: 0 }}>
          {initials(message.senderName, message.senderName)}
        </Avatar>
      )}

      <Box sx={{ maxWidth: "70%" }}>
        <Paper
          elevation={0}
          sx={{
            px: 1.5,
            py: 1,
            borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
            bgcolor: isMe ? theme.palette.primary.main : isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)",
            color: isMe ? (isDark ? "#0f172a" : "#fff") : "text.primary",
            wordBreak: "break-word",
          }}
        >
          <Typography variant="body2" sx={{ fontSize: "0.875rem", lineHeight: 1.5 }}>
            {message.content}
          </Typography>
        </Paper>
        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.25, display: "block", textAlign: isMe ? "right" : "left", fontSize: "0.7rem" }}>
          {relativeTime(message.createdAt)}
        </Typography>
      </Box>

      {isMe && (
        <>
          <Box className="msg-actions" sx={{ opacity: 0, transition: "opacity 0.15s", ml: 0.5, alignSelf: "flex-start" }}>
            <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVertIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
          <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
            <MenuItem
              onClick={() => {
                onDelete(message.id);
                setMenuAnchor(null);
              }}
              sx={{ color: "error.main", gap: 1, fontSize: "0.875rem" }}
            >
              <DeleteOutlineIcon fontSize="small" /> Delete
            </MenuItem>
          </Menu>
        </>
      )}
    </Box>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AdChatPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const adIdParam = searchParams.get("adId");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const me = session?.user?.id ?? "";

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: convosData, isLoading: loadingConvos } = useQuery({
    queryKey: ["adChatConversations"],
    queryFn: () => fetch("/api/ad-chat/conversations").then((r) => r.json()) as Promise<{ conversations: Conversation[] }>,
    staleTime: 30_000,
    enabled: !!me,
  });
  const conversations = convosData?.conversations ?? [];

  const { data: searchData, isFetching: searching } = useQuery({
    queryKey: ["adChatSearch", searchQuery],
    queryFn: () => fetch(`/api/ad-chat/search?q=${encodeURIComponent(searchQuery)}`).then((r) => r.json()) as Promise<{ users: SearchUser[] }>,
    enabled: searchQuery.length >= 2,
    staleTime: 10_000,
  });
  const searchResults = searchData?.users ?? [];

  const selectedConvo = conversations.find((c) => c.id === selectedId) ?? null;

  const { data: messagesData, isLoading: loadingMessages } = useQuery({
    queryKey: ["adChatMessages", selectedId],
    queryFn: () => fetch(`/api/ad-chat/conversations/${selectedId}/messages`).then((r) => r.json()) as Promise<{ messages: Message[] }>,
    enabled: !!selectedId,
    staleTime: 0,
  });
  const messages = messagesData?.messages ?? [];

  // Real-time SSE
  useAdChatSSE(selectedId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-open conversation from URL param
  useEffect(() => {
    if (!adIdParam || !me) return;
    findOrCreateConvo.mutate(adIdParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adIdParam, me]);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const findOrCreateConvo = useMutation({
    mutationFn: (targetUserId: string) =>
      fetch("/api/ad-chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d.conversation as Conversation;
      }),
    onSuccess: (convo) => {
      queryClient.invalidateQueries({ queryKey: ["adChatConversations"] });
      setSelectedId(convo.id);
      setSearchQuery("");
      setSearchFocus(false);
      setMobileView("chat");
    },
  });

  const sendMessage = useMutation({
    mutationFn: () =>
      fetch(`/api/ad-chat/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageText.trim() }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d.message as Message;
      }),
    onSuccess: (msg) => {
      setMessageText("");
      queryClient.setQueryData<{ messages: Message[] }>(["adChatMessages", selectedId], (old) => ({ messages: [...(old?.messages ?? []), msg] }));
      queryClient.invalidateQueries({ queryKey: ["adChatConversations"] });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: (msgId: string) => fetch(`/api/ad-chat/messages/${msgId}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: (_, msgId) => {
      queryClient.setQueryData<{ messages: Message[] }>(["adChatMessages", selectedId], (old) => ({ messages: (old?.messages ?? []).filter((m) => m.id !== msgId) }));
    },
  });

  const blockConvo = useMutation({
    mutationFn: (action: "block" | "unblock") =>
      fetch(`/api/ad-chat/conversations/${selectedId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adChatConversations"] });
      setMenuAnchor(null);
    },
  });

  // ── Derived state ──────────────────────────────────────────────────────────

  const canSend = useCallback(() => {
    if (!selectedConvo || !messageText.trim()) return false;
    const s = selectedConvo.status;
    if (s === "BLOCKED" || s === "DO_NOT_DISTURB") return false;
    if (s === "PENDING" && selectedConvo.initiatorId === me) return false;
    return true;
  }, [selectedConvo, messageText, me]);

  const inputPlaceholder = (() => {
    if (!selectedConvo) return "Select a conversation";
    const s = selectedConvo.status;
    if (s === "DO_NOT_DISTURB") return "This user has their messages on do not disturb";
    if (s === "BLOCKED") return "You've muted this conversation";
    if (s === "PENDING" && selectedConvo.initiatorId === me) return "Awaiting their response…";
    return "Type a message…";
  })();

  const handleSend = () => {
    if (!canSend()) return;
    sendMessage.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const borderColor = isDark ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.1)";

  // Left pane: conversation list + search
  const listPane = (
    <Box
      sx={{
        width: { xs: "100%", sm: 300 },
        flexShrink: 0,
        height: "100%",
        display: { xs: mobileView === "chat" ? "none" : "flex", sm: "flex" },
        flexDirection: "column",
        borderRight: { sm: `1px solid ${borderColor}` },
      }}
    >
      {/* Search */}
      <Box sx={{ p: 1.5, borderBottom: `1px solid ${borderColor}` }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search by email or name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setSearchFocus(true)}
          onBlur={() => setTimeout(() => setSearchFocus(false), 200)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
              </InputAdornment>
            ),
            endAdornment: searching ? (
              <InputAdornment position="end">
                <CircularProgress size={14} />
              </InputAdornment>
            ) : null,
          }}
          InputLabelProps={{ shrink: true }}
        />

        {/* Search results dropdown */}
        {searchFocus && searchQuery.length >= 2 && (
          <Paper
            elevation={4}
            sx={{
              position: "absolute",
              zIndex: 1300,
              mt: 0.5,
              width: 268,
              maxHeight: 260,
              overflow: "auto",
            }}
          >
            {searchResults.length === 0 && !searching ? (
              <Typography variant="caption" color="text.disabled" sx={{ p: 1.5, display: "block" }}>
                No users found
              </Typography>
            ) : (
              searchResults.map((u) => (
                <MenuItem key={u.id} onClick={() => findOrCreateConvo.mutate(u.id)} sx={{ gap: 1, py: 1 }}>
                  <Avatar src={u.image ?? undefined} sx={{ width: 30, height: 30, fontSize: "0.75rem" }}>
                    {initials(u.name, u.email)}
                  </Avatar>
                  <Box>
                    <Typography variant="body2" fontWeight={600} lineHeight={1.2}>
                      {u.name || u.email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {u.schoolName ?? u.email}
                    </Typography>
                  </Box>
                </MenuItem>
              ))
            )}
          </Paper>
        )}
      </Box>

      {/* Conversations list */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {loadingConvos ? (
          <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : conversations.length === 0 ? (
          <Box sx={{ p: 2, textAlign: "center" }}>
            <ChatIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Messages
            </Typography>
          </Box>
        ) : (
          conversations.map((convo) => {
            const isActive = convo.id === selectedId;
            const other = convo.otherUser;
            const isDnd = convo.status === "DO_NOT_DISTURB";
            return (
              <Box
                key={convo.id}
                onClick={() => {
                  setSelectedId(convo.id);
                  setMobileView("chat");
                }}
                sx={{
                  px: 1.5,
                  py: 1.25,
                  cursor: "pointer",
                  bgcolor: isActive ? (isDark ? "rgba(99,102,241,0.12)" : "rgba(99,102,241,0.07)") : "transparent",
                  borderLeft: isActive ? "3px solid" : "3px solid transparent",
                  borderLeftColor: isActive ? "primary.main" : "transparent",
                  "&:hover": { bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)" },
                  transition: "all 0.15s",
                }}
              >
                <Stack direction="row" gap={1.25} alignItems="flex-start">
                  <Badge badgeContent={convo.unreadCount || null} color="primary" max={99}>
                    <Avatar src={other.image ?? undefined} sx={{ width: 36, height: 36, fontSize: "0.8rem" }}>
                      {initials(other.name, other.email)}
                    </Avatar>
                  </Badge>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" fontWeight={convo.unreadCount ? 700 : 500} noWrap sx={{ flex: 1, mr: 0.5, fontSize: "0.875rem" }}>
                        {other.name || other.email}
                      </Typography>
                      {convo.lastMessage && (
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem", flexShrink: 0 }}>
                          {relativeTime(convo.lastMessage.createdAt)}
                        </Typography>
                      )}
                    </Stack>
                    <Typography variant="caption" color={isDnd ? "warning.main" : "text.secondary"} noWrap sx={{ fontSize: "0.75rem", display: "block" }}>
                      {isDnd
                        ? "Do not disturb"
                        : convo.status === "PENDING"
                          ? "Pending…"
                          : convo.lastMessage
                            ? (convo.lastMessage.isFromMe ? "You: " : "") + convo.lastMessage.content
                            : (other.schoolName ?? other.email)}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );

  // Right pane: message thread
  const chatPane = (
    <Box
      sx={{
        flex: 1,
        display: { xs: mobileView === "list" ? "none" : "flex", sm: "flex" },
        flexDirection: "column",
        height: "100%",
        minWidth: 0,
      }}
    >
      {!selectedConvo ? (
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4, gap: 2 }}>
          <LockIcon sx={{ fontSize: 48, color: "text.disabled" }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary">
            Private Chat
          </Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth={320}>
            Start a private encrypted conversation with athletic directors, coaches, or staff members.
          </Typography>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <LockIcon sx={{ fontSize: 14, color: "text.disabled" }} />
            <Typography variant="caption" color="text.disabled">
              All messages are encrypted
            </Typography>
          </Stack>
        </Box>
      ) : (
        <>
          {/* Header */}
          <Box sx={{ px: 2, py: 1.25, borderBottom: `1px solid ${borderColor}`, display: "flex", alignItems: "center", gap: 1.5 }}>
            <IconButton size="small" onClick={() => setMobileView("list")} sx={{ display: { sm: "none" }, mr: 0.5 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Avatar src={selectedConvo.otherUser.image ?? undefined} sx={{ width: 36, height: 36, fontSize: "0.8rem" }}>
              {initials(selectedConvo.otherUser.name, selectedConvo.otherUser.email)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={700} noWrap>
                {selectedConvo.otherUser.name || selectedConvo.otherUser.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {selectedConvo.otherUser.schoolName ?? selectedConvo.otherUser.email}
              </Typography>
            </Box>

            {selectedConvo.status === "PENDING" && (
              <Chip label={selectedConvo.initiatorId === me ? "Awaiting reply" : "New request"} size="small" color="warning" variant="outlined" sx={{ fontSize: "0.7rem" }} />
            )}
            {selectedConvo.status === "BLOCKED" && <Chip label="Muted" size="small" color="default" variant="outlined" sx={{ fontSize: "0.7rem" }} />}

            <Tooltip title="Options">
              <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                <MoreVertIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
              {selectedConvo.status !== "BLOCKED" ? (
                <MenuItem onClick={() => blockConvo.mutate("block")} sx={{ gap: 1, fontSize: "0.875rem" }}>
                  <BlockIcon fontSize="small" />
                  Mute conversation
                </MenuItem>
              ) : selectedConvo.status === "BLOCKED" ? (
                <MenuItem onClick={() => blockConvo.mutate("unblock")} sx={{ gap: 1, fontSize: "0.875rem" }}>
                  <BlockIcon fontSize="small" />
                  Unmute conversation
                </MenuItem>
              ) : null}
            </Menu>
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: "auto", px: 2, py: 1.5 }}>
            {loadingMessages ? (
              <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                <CircularProgress size={24} />
              </Box>
            ) : messages.length === 0 ? (
              <Box sx={{ textAlign: "center", pt: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  {selectedConvo.status === "PENDING" && selectedConvo.initiatorId !== me ? `${selectedConvo.otherUser.name || "This AD"} sent you a chat request` : "No messages yet. Say hello!"}
                </Typography>
              </Box>
            ) : (
              messages.map((msg) => <MessageBubble key={msg.id} message={msg} isMe={msg.senderUserId === me} onDelete={(id) => deleteMessage.mutate(id)} />)
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Status banners */}
          {selectedConvo.status === "PENDING" && selectedConvo.initiatorId === me && (
            <Alert severity="info" icon={false} sx={{ mx: 2, mb: 1, py: 0.5, fontSize: "0.8rem" }}>
              Your message has been sent. The conversation opens once they reply.
            </Alert>
          )}
          {selectedConvo.status === "DO_NOT_DISTURB" && (
            <Alert severity="warning" icon={false} sx={{ mx: 2, mb: 1, py: 0.5, fontSize: "0.8rem" }}>
              This user has their messages on do not disturb.
            </Alert>
          )}
          {selectedConvo.status === "BLOCKED" && (
            <Alert severity="info" icon={false} sx={{ mx: 2, mb: 1, py: 0.5, fontSize: "0.8rem" }}>
              You&apos;ve muted this conversation. They can&apos;t message you.
            </Alert>
          )}

          {/* Input */}
          <Box sx={{ px: 2, pb: 2, pt: 1, borderTop: `1px solid ${borderColor}` }}>
            <Stack direction="row" gap={1} alignItems="flex-end">
              <TextField
                inputRef={inputRef}
                size="small"
                fullWidth
                multiline
                maxRows={4}
                placeholder={inputPlaceholder}
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={!canSend() && messageText === ""}
                inputProps={{ maxLength: 5000 }}
                InputLabelProps={{ shrink: true }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
              />
              <IconButton
                color="primary"
                onClick={handleSend}
                disabled={!canSend() || sendMessage.isPending}
                sx={{
                  bgcolor: canSend() ? "primary.main" : "action.disabledBackground",
                  color: canSend() ? (isDark ? "#0f172a" : "#fff") : "text.disabled",
                  "&:hover": { bgcolor: "primary.dark" },
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                }}
              >
                {sendMessage.isPending ? <CircularProgress size={16} color="inherit" /> : <SendIcon fontSize="small" />}
              </IconButton>
            </Stack>
            <Stack direction="row" alignItems="center" gap={0.5} sx={{ mt: 0.5 }}>
              <LockIcon sx={{ fontSize: 11, color: "text.disabled" }} />
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.65rem" }}>
                End-to-end encrypted
              </Typography>
            </Stack>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2.5 }, height: "calc(100vh - 80px)", display: "flex", flexDirection: "column" }}>
      {/* Page header */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>
          Chat
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Communicate with athletic directors, coaches and staff
        </Typography>
      </Box>

      {/* Chat layout */}
      <Paper
        elevation={0}
        sx={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          border: `1px solid ${borderColor}`,
          borderRadius: 3,
          borderTopLeftRadius: "10px",
          position: "relative",
        }}
      >
        {listPane}
        <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" }, borderColor }} />
        {chatPane}
      </Paper>
    </Box>
  );
}
