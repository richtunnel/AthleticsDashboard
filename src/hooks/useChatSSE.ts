"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  senderName: string;
  content: string;
  createdAt: string;
  readAt: string | null;
}

/**
 * React hook that opens a Server-Sent Events connection to receive
 * real-time chat messages for a specific conversation.
 *
 * - Appends new messages to the React Query cache (no refetch needed)
 * - Auto-reconnects on connection loss (EventSource does this natively)
 * - Closes the connection on unmount or conversation change
 */
export function useChatSSE(conversationId: string | null) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!conversationId) {
      closeConnection();
      return;
    }

    // Close any existing connection before opening a new one
    closeConnection();

    const url = `/api/chat/stream?conversationId=${encodeURIComponent(conversationId)}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const message: ChatMessage = JSON.parse(event.data);

        // Append the new message to the React Query cache
        queryClient.setQueryData<ChatMessage[]>(
          ["chatMessages", conversationId],
          (oldMessages) => {
            if (!oldMessages) return [message];
            // Prevent duplicates (optimistic update may already have it)
            if (oldMessages.some((m) => m.id === message.id)) {
              return oldMessages;
            }
            return [...oldMessages, message];
          }
        );

        // Also invalidate the conversations list to update last message preview
        queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      } catch (err) {
        console.error("[SSE] Failed to parse message:", err);
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically reconnects on error.
      // We just log it for debugging; no manual reconnection needed.
      console.warn("[SSE] Connection error, will auto-reconnect...");
    };

    return () => {
      closeConnection();
    };
  }, [conversationId, queryClient, closeConnection]);

  return { closeConnection };
}
