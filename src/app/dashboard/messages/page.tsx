"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Avatar,
  IconButton,
  Tooltip,
  Button,
  Alert,
} from "@mui/material";
import { Person, ChatBubbleOutline, Delete, Lock } from "@mui/icons-material";
import ConversationList from "@/components/chat/ConversationList";
import MessageThread from "@/components/chat/MessageThread";
import MessageInput from "@/components/chat/MessageInput";
import { useChatSSE } from "@/hooks/useChatSSE";

interface ConversationItem {
  id: string;
  schoolId: string;
  schoolName: string;
  parentName?: string;
  parentImage?: string | null;
  parentId?: string;
  athleteName?: string | null;
  sport?: string | null;
  gradeLevel?: string | null;
  lastMessage: {
    content: string;
    createdAt: string;
    isFromMe: boolean;
  } | null;
  unreadCount: number;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  senderImage?: string | null;
  content: string;
  readAt: string | null;
  createdAt: string;
}

interface ConversationsFetchResult {
  conversations: ConversationItem[];
  /** Set when the user is a collaborator without chat access */
  chatAccessDenied?: boolean;
  /** Current chat access status for collaborators */
  chatAccess?: "PENDING" | "REVOKED" | null;
}

async function fetchConversations(): Promise<ConversationsFetchResult> {
  const res = await fetch("/api/chat/conversations");
  if (res.status === 403) {
    const data = await res.json();
    if (data.error === "chat_access_denied") {
      return {
        conversations: [],
        chatAccessDenied: true,
        chatAccess: data.chatAccess ?? null,
      };
    }
  }
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

async function fetchMessages(conversationId: string): Promise<{ messages: ChatMessage[] }> {
  const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

export default function ADMessagesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);
  const [requestingAccess, setRequestingAccess] = useState(false);
  const [accessRequestSent, setAccessRequestSent] = useState(false);
  const [accessRequestError, setAccessRequestError] = useState<string | null>(null);

  const currentUserId = (session?.user as any)?.id || "";

  // Fetch conversations (403 → chatAccessDenied for collaborators)
  const { data: convData, isLoading: convLoading } = useQuery({
    queryKey: ["chatConversations"],
    queryFn: fetchConversations,
  });

  const handleRequestChatAccess = async () => {
    setRequestingAccess(true);
    setAccessRequestError(null);
    try {
      const res = await fetch("/api/collaboration/chat-access", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setAccessRequestError(data.error || "Failed to send request");
      } else {
        setAccessRequestSent(true);
        queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      }
    } catch {
      setAccessRequestError("Network error — please try again");
    } finally {
      setRequestingAccess(false);
    }
  };

  // Fetch messages for selected conversation
  const { data: msgData, isLoading: msgLoading } = useQuery({
    queryKey: ["chatMessages", selectedConversation?.id],
    queryFn: () => fetchMessages(selectedConversation!.id),
    enabled: !!selectedConversation?.id,
    select: (data) => data.messages,
  });

  // SSE for real-time message updates
  useChatSSE(selectedConversation?.id || null);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (selectedConversation?.id && selectedConversation.unreadCount > 0) {
      fetch(`/api/chat/conversations/${selectedConversation.id}/read`, {
        method: "POST",
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      });
    }
  }, [selectedConversation?.id, selectedConversation?.unreadCount, queryClient]);

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(
        `/api/chat/conversations/${selectedConversation!.id}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (newMessage: ChatMessage) => {
      queryClient.setQueryData<{ messages: ChatMessage[] }>(
        ["chatMessages", selectedConversation!.id],
        (old) => {
          const msgs = old?.messages || [];
          if (msgs.some((m) => m.id === newMessage.id)) return old!;
          return { ...old, messages: [...msgs, newMessage] };
        }
      );
      queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
    },
  });

  // Delete conversation mutation
  const deleteConversation = useMutation({
    mutationFn: async (conversationId: string) => {
      const res = await fetch(`/api/chat/conversations/${conversationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      setSelectedConversation(null);
    },
  });

  const handleSend = useCallback(
    async (content: string) => {
      await sendMessage.mutateAsync(content);
    },
    [sendMessage]
  );

  if (convLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Collaborator without approved chat access — show gate
  if (convData?.chatAccessDenied) {
    const isPending = convData.chatAccess === "PENDING";
    const isRevoked = convData.chatAccess === "REVOKED";

    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Messages
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Chat with parents in real time
          </Typography>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 400,
            gap: 2,
            p: 4,
          }}
        >
          <Lock sx={{ fontSize: 56, color: "text.disabled" }} />
          <Typography variant="h6" fontWeight={600} textAlign="center">
            Access Required
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ maxWidth: 400 }}>
            {isPending
              ? "Your access request has been sent and is pending approval from the Athletic Director."
              : isRevoked
              ? "Your access to parent messages has been revoked by the Athletic Director. Contact them to request access again."
              : "You don't have permission to view parent messages. Request access from the Athletic Director."}
          </Typography>

          {accessRequestSent && (
            <Alert severity="success" sx={{ mt: 1, maxWidth: 400 }}>
              Access request sent! The Athletic Director will be notified by email.
            </Alert>
          )}

          {accessRequestError && (
            <Alert severity="error" sx={{ mt: 1, maxWidth: 400 }} onClose={() => setAccessRequestError(null)}>
              {accessRequestError}
            </Alert>
          )}

          {!isPending && !accessRequestSent && (
            <Button
              variant="contained"
              size="large"
              onClick={handleRequestChatAccess}
              disabled={requestingAccess}
              startIcon={requestingAccess ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ mt: 1, px: 4, borderRadius: 2 }}
            >
              {requestingAccess ? "Sending Request…" : "Request Access"}
            </Button>
          )}

          {isPending && !accessRequestSent && (
            <Button
              variant="outlined"
              size="large"
              onClick={handleRequestChatAccess}
              disabled={requestingAccess}
              startIcon={requestingAccess ? <CircularProgress size={18} color="inherit" /> : undefined}
              sx={{ mt: 1, px: 4, borderRadius: 2 }}
            >
              {requestingAccess ? "Sending…" : "Re-send Request"}
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Messages
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Chat with parents in real time
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ height: "calc(100vh - 240px)", minHeight: 500 }}>
        {/* Conversation List - Left Panel */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%", overflow: "auto" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, px: 0.5 }}>
                Parent Conversations
              </Typography>

              <ConversationList
                conversations={convData?.conversations || []}
                selectedId={selectedConversation?.id || null}
                onSelect={(conv) => setSelectedConversation(conv)}
                variant="ad"
                isLoading={convLoading}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Message Thread - Right Panel */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {selectedConversation ? (
              <>
                {/* Header */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    borderBottom: 1,
                    borderColor: "divider",
                    bgcolor: "background.paper",
                  }}
                >
                  <Avatar
                    src={selectedConversation.parentImage || undefined}
                    sx={{ width: 36, height: 36, bgcolor: "primary.main" }}
                  >
                    <Person fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {selectedConversation.parentName || "Parent"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {[selectedConversation.athleteName, selectedConversation.sport]
                        .filter(Boolean)
                        .join(" · ") || selectedConversation.schoolName}
                    </Typography>
                  </Box>
                  <Box sx={{ ml: "auto" }}>
                    <Tooltip title="Delete Conversation">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => {
                          if (confirm("Are you sure you want to delete this conversation? This cannot be undone.")) {
                            deleteConversation.mutate(selectedConversation.id);
                          }
                        }}
                        disabled={deleteConversation.isPending}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Messages */}
                {msgLoading ? (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CircularProgress size={32} />
                  </Box>
                ) : (
                  <MessageThread
                    messages={msgData || []}
                    currentUserId={currentUserId}
                  />
                )}

                {/* Input */}
                <MessageInput
                  onSend={handleSend}
                  disabled={sendMessage.isPending}
                />
              </>
            ) : (
              <Box
                sx={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  p: 4,
                }}
              >
                <ChatBubbleOutline sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  Select a conversation
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  Choose a parent from the list to view their messages
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
