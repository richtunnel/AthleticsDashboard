"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface AdMessage {
  id:             string;
  conversationId: string;
  senderUserId:   string;
  senderName:     string;
  senderImage?:   string | null;
  content:        string;
  createdAt:      string;
  readAt:         string | null;
}

/** SSE hook for a single AD chat conversation. Same pattern as useChatSSE. */
export function useAdChatSSE(conversationId: string | null) {
  const queryClient    = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!conversationId) { closeConnection(); return; }
    closeConnection();

    const cached = queryClient.getQueryData<{ messages: AdMessage[] }>(
      ["adChatMessages", conversationId],
    );
    const lastKnownAt = cached?.messages?.at(-1)?.createdAt;

    const params = new URLSearchParams({ conversationId });
    if (lastKnownAt) params.set("since", lastKnownAt);

    const es = new EventSource(`/api/ad-chat/stream?${params}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data.id || !data.content) return;

        const message: AdMessage = data;
        queryClient.setQueryData<{ messages: AdMessage[] }>(
          ["adChatMessages", conversationId],
          (old) => {
            const msgs = old?.messages ?? [];
            if (msgs.some((m) => m.id === message.id)) return old!;
            return { ...old, messages: [...msgs, message] };
          },
        );
        queryClient.invalidateQueries({ queryKey: ["adChatConversations"] });
        queryClient.invalidateQueries({ queryKey: ["adChatUnread"] });
      } catch (err) {
        console.error("[AdChatSSE]", err);
      }
    };

    es.onerror = () => {
      console.warn("[AdChatSSE] Connection error, will auto-reconnect...");
    };

    return () => { closeConnection(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, queryClient, closeConnection]);

  return { closeConnection };
}
