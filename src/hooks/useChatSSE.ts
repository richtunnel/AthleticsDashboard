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
 * The server side polls the database every 2 s, so this works in production
 * regardless of Nginx buffering, multiple processes, or container restarts.
 *
 * On (re)connect the hook passes `since` — the createdAt of the last cached
 * message — so the server starts its cursor at the right point and no
 * messages are missed or duplicated across reconnections.
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

    // Pass the createdAt of the last known message as the polling cursor.
    // The server will only deliver messages strictly after this timestamp,
    // preventing duplicates and ensuring no gaps on reconnect.
    const cached = queryClient.getQueryData<{ messages: ChatMessage[] }>(
      ["chatMessages", conversationId]
    );
    const lastKnownAt = cached?.messages?.at(-1)?.createdAt;

    const params = new URLSearchParams({ conversationId });
    if (lastKnownAt) params.set("since", lastKnownAt);

    const url = `/api/chat/stream?${params.toString()}`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Skip control messages (connected handshake, etc.)
        if (!data.id || !data.content) return;

        const message: ChatMessage = data;

        // Append the new message to the React Query cache
        queryClient.setQueryData<{ messages: ChatMessage[] }>(
          ["chatMessages", conversationId],
          (old) => {
            const msgs = old?.messages || [];
            // Deduplicate: optimistic updates may already have this message
            if (msgs.some((m) => m.id === message.id)) return old!;
            return { ...old, messages: [...msgs, message] };
          }
        );

        // Refresh the conversations list so the last-message preview updates
        queryClient.invalidateQueries({ queryKey: ["chatConversations"] });
      } catch (err) {
        console.error("[SSE] Failed to parse message:", err);
      }
    };

    eventSource.onerror = () => {
      // EventSource auto-reconnects on error. When it reconnects, this effect
      // will NOT re-run (conversationId hasn't changed), so the existing
      // EventSource with its original `since` cursor continues.
      // The server-side 2-second DB poll ensures no messages are lost.
      console.warn("[SSE] Connection error, will auto-reconnect...");
    };

    return () => {
      closeConnection();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, queryClient, closeConnection]);

  return { closeConnection };
}
