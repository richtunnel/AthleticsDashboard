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
  Button,
  IconButton,
  Tooltip,
} from "@mui/material";
import { School, ChatBubbleOutline, Delete } from "@mui/icons-material";
import ConversationList from "@/components/chat/ConversationList";
import MessageThread from "@/components/chat/MessageThread";
import MessageInput from "@/components/chat/MessageInput";
import { useChatSSE } from "@/hooks/useChatSSE";

interface ConversationItem {
  id: string;
  schoolId: string;
  schoolName: string;
  adName?: string;
  adImage?: string | null;
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

interface LinkedSchool {
  id: string;
  schoolId: string;
  schoolName: string;
}

async function fetchConversations(): Promise<{ conversations: ConversationItem[] }> {
  const res = await fetch("/api/parent/chat/conversations");
  if (!res.ok) throw new Error("Failed to fetch conversations");
  return res.json();
}

async function fetchMessages(conversationId: string): Promise<{ messages: ChatMessage[] }> {
  const res = await fetch(`/api/parent/chat/conversations/${conversationId}/messages`);
  if (!res.ok) throw new Error("Failed to fetch messages");
  return res.json();
}

async function fetchLinkedSchools(): Promise<{ schools: LinkedSchool[] }> {
  const res = await fetch("/api/parent/linked-schools");
  if (!res.ok) throw new Error("Failed to fetch linked schools");
  return res.json();
}

export default function ParentChatPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [selectedConversation, setSelectedConversation] = useState<ConversationItem | null>(null);

  const currentUserId = (session?.user as any)?.id || "";

  // Fetch conversations
  const { data: convData, isLoading: convLoading } = useQuery({
    queryKey: ["chatConversations"],
    queryFn: fetchConversations,
  });

  // Fetch linked schools (to show "start conversation" for schools without conversations)
  const { data: schoolsData } = useQuery({
    queryKey: ["linkedSchools"],
    queryFn: fetchLinkedSchools,
  });

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
      fetch(`/api/parent/chat/conversations/${selectedConversation.id}/read`, {
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
        `/api/parent/chat/conversations/${selectedConversation!.id}/messages`,
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
      // Add the message to the cache (must match raw shape before `select`)
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
      const res = await fetch(`/api/parent/chat/conversations/${conversationId}`, {
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

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async (schoolId: string) => {
      const res = await fetch("/api/parent/chat/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      setSelectedConversation({
        id: data.id,
        schoolId: data.schoolId,
        schoolName: data.schoolName,
        lastMessage: null,
        unreadCount: 0,
      });
    },
  });

  const handleSend = useCallback(
    async (content: string) => {
      await sendMessage.mutateAsync(content);
    },
    [sendMessage]
  );

  // Find schools that don't have conversations yet
  const existingSchoolIds = new Set(
    (convData?.conversations || []).map((c) => c.schoolId)
  );
  const schoolsWithoutConversations = (schoolsData?.schools || []).filter(
    (s) => !existingSchoolIds.has(s.schoolId)
  );

  if (convLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Chat
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Message your school&apos;s athletic director in real time
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ height: "calc(100vh - 240px)", minHeight: 500 }}>
        {/* Conversation List - Left Panel */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: "100%", overflow: "auto" }}>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, px: 0.5 }}>
                Conversations
              </Typography>

              <ConversationList
                conversations={convData?.conversations || []}
                selectedId={selectedConversation?.id || null}
                onSelect={(conv) => setSelectedConversation(conv)}
                variant="parent"
                isLoading={convLoading}
              />

              {/* Show "Start Conversation" for linked schools without conversations */}
              {schoolsWithoutConversations.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mb: 1, px: 0.5 }}
                  >
                    Start a new conversation
                  </Typography>
                  {schoolsWithoutConversations.map((school) => (
                    <Button
                      key={school.id}
                      fullWidth
                      variant="outlined"
                      size="small"
                      startIcon={<School />}
                      onClick={() => createConversation.mutate(school.schoolId)}
                      disabled={createConversation.isPending}
                      sx={{ mb: 0.5, justifyContent: "flex-start", textTransform: "none" }}
                    >
                      {school.schoolName}
                    </Button>
                  ))}
                </Box>
              )}
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
                    src={selectedConversation.adImage || undefined}
                    sx={{ width: 36, height: 36, bgcolor: "grey.300" }}
                  >
                    <School fontSize="small" />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      {selectedConversation.adName || "Athletic Director"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedConversation.schoolName}
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
                  Choose a school from the list to start chatting
                </Typography>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
