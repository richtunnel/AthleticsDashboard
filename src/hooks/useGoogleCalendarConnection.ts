import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CalendarStatus {
  connected: boolean;
  scopes: string[];
}

interface UseGoogleCalendarConnectionReturn {
  isConnected: boolean;
  isLoading: boolean;
  scopes: string[];
  connect: (returnTo?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refetch: () => void;
}

/**
 * Hook for managing Google Calendar connection state
 * 
 * Features:
 * - Check connection status
 * - Initiate incremental OAuth flow
 * - Disconnect calendar
 * - Auto-refetch after mutations
 */
export function useGoogleCalendarConnection(): UseGoogleCalendarConnectionReturn {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Query to check connection status
  const { data, isLoading, refetch } = useQuery<CalendarStatus>({
    queryKey: ["googleCalendarStatus"],
    queryFn: async () => {
      const response = await fetch("/api/auth/google-calendar/status");
      if (!response.ok) {
        throw new Error("Failed to check calendar status");
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Mutation for disconnecting
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/google-calendar/disconnect", {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      // Invalidate all calendar-related queries to update all components
      queryClient.invalidateQueries({ queryKey: ["googleCalendarStatus"] });
      queryClient.invalidateQueries({ queryKey: ["googleCalendars"] });
      queryClient.invalidateQueries({ queryKey: ["calendarGroupMappings"] });
      queryClient.invalidateQueries({ queryKey: ["autoCalendarSync"] });
    },
  });

  // Function to initiate connection
  const connect = useCallback(async (returnTo?: string) => {
    try {
      setIsConnecting(true);

      const response = await fetch("/api/auth/google-calendar/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          returnTo: returnTo || window.location.pathname,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initiate connection");
      }

      const data = await response.json();

      if (data.authUrl) {
        // Redirect to Google OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error) {
      console.error("Error connecting calendar:", error);
      setIsConnecting(false);
      throw error;
    }
  }, []);

  // Function to disconnect
  const disconnect = useCallback(async () => {
    await disconnectMutation.mutateAsync();
  }, [disconnectMutation]);

  return {
    isConnected: data?.connected || false,
    isLoading: isLoading || isConnecting,
    scopes: data?.scopes || [],
    connect,
    disconnect,
    refetch: () => refetch(),
  };
}
