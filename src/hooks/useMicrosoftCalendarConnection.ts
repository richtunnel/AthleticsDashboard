import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface CalendarStatus {
  connected: boolean;
  scopes: string[];
}

interface UseMicrosoftCalendarConnectionReturn {
  isConnected: boolean;
  isLoading: boolean;
  scopes: string[];
  connect: (returnTo?: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refetch: () => void;
}

/**
 * Hook for managing Microsoft Calendar connection state
 *
 * Features:
 * - Check connection status
 * - Initiate incremental OAuth flow
 * - Disconnect calendar
 * - Auto-refetch after mutations
 */
export function useMicrosoftCalendarConnection(): UseMicrosoftCalendarConnectionReturn {
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Query to check connection status
  const { data, isLoading, refetch } = useQuery<CalendarStatus>({
    queryKey: ["microsoftCalendarStatus"],
    queryFn: async () => {
      const response = await fetch("/api/auth/microsoft-calendar/status");
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
      const response = await fetch("/api/auth/microsoft-calendar/disconnect", {
        method: "POST",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disconnect");
      }
      return response.json();
    },
    onSuccess: () => {
      // Refetch status after disconnect
      queryClient.invalidateQueries({ queryKey: ["microsoftCalendarStatus"] });
    },
  });

  // Function to initiate connection
  const connect = useCallback(async (returnTo?: string) => {
    try {
      setIsConnecting(true);

      const response = await fetch("/api/auth/microsoft-calendar/connect", {
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
        // Redirect to Microsoft OAuth
        window.location.href = data.authUrl;
      } else {
        throw new Error("No authorization URL received");
      }
    } catch (error) {
      console.error("Error connecting Microsoft calendar:", error);
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
