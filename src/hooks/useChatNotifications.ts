"use client";

import { useEffect, useRef, useCallback } from "react";
import { useNotifications } from "@/contexts/NotificationContext";

/**
 * React hook that opens a Server-Sent Events connection to receive
 * real-time chat notification events for the authenticated user.
 *
 * When a new message arrives (from the other party), it adds a notification
 * to the existing NotificationContext so it appears in the header bell icon.
 *
 * @param streamUrl - The SSE endpoint URL (e.g. "/api/chat/notifications/stream")
 */
export function useChatNotifications(streamUrl: string) {
  const { addNotification } = useNotifications();
  const eventSourceRef = useRef<EventSource | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const closeConnection = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Close any existing connection before opening a new one
    closeConnection();

    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Store the current user's ID from the connected event
        if (data.type === "connected") {
          currentUserIdRef.current = data.userId;
          return;
        }

        // Skip notifications for messages sent by the current user
        if (data.senderUserId === currentUserIdRef.current) {
          return;
        }

        // Truncate long message previews
        const preview = data.content?.length > 50
          ? data.content.substring(0, 50) + "..."
          : data.content || "";

        addNotification(
          `New message from ${data.senderName || "someone"}: ${preview}`,
          "info"
        );
      } catch (err) {
        console.error("[ChatNotifications] Failed to parse event:", err);
      }
    };

    eventSource.onerror = () => {
      // EventSource automatically reconnects on error
      console.warn("[ChatNotifications] Connection error, will auto-reconnect...");
    };

    return () => {
      closeConnection();
    };
  }, [streamUrl, addNotification, closeConnection]);

  return { closeConnection };
}
