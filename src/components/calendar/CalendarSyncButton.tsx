"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa";
import { useNotifications } from "@/contexts/NotificationContext";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

interface CalendarSyncButtonProps {
  gameId: string;
  isSynced?: boolean;
}

export function CalendarSyncButton({ gameId, isSynced = false }: CalendarSyncButtonProps) {
  const queryClient = useQueryClient();
  const { addNotification } = useNotifications();
  const [synced, setSynced] = useState(isSynced);

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/sync/${gameId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync");
      return res.json();
    },
    onSuccess: () => {
      setSynced(true);
      queryClient.invalidateQueries({ queryKey: ["games"] });
      addNotification("Successfully synced to Google Calendar", "success");
    },
    onError: () => {
      addNotification("Failed to sync to Google Calendar", "error");
    },
  });

  const unsyncMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/calendar/sync/${gameId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to unsync");
      return res.json();
    },
    onSuccess: () => {
      setSynced(false);
      queryClient.invalidateQueries({ queryKey: ["games"] });
      addNotification("Removed from Google Calendar", "success");
    },
    onError: () => {
      addNotification("Failed to remove from Google Calendar", "error");
    },
  });

  const handleClick = () => {
    trackEvent("Calendar Sync Button Clicked", {
      source: "calendar_sync_button",
      action: synced ? "unsync_from_calendar" : "sync_to_calendar",
      game_id: gameId,
      was_synced: synced,
    });

    if (synced) {
      unsyncMutation.mutate();
    } else {
      syncMutation.mutate();
    }
  };

  const isLoading = syncMutation.isPending || unsyncMutation.isPending;

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        synced ? "bg-green-100 text-green-700 hover:bg-green-200 dark:hover:bg-gray-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={synced ? "Synced to Google Calendar" : "Sync to Google Calendar"}
    >
      {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Calendar size={16} />}
      {synced ? "Synced" : "Sync"}
    </button>
  );
}

export function SyncAllButton() {
  const { addNotification } = useNotifications();
  
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/calendar/sync-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync all");
      return res.json();
    },
    onSuccess: (data) => {
      const successCount = data?.results?.filter((r: any) => r.ok)?.length || 0;
      const failCount = data?.results?.filter((r: any) => !r.ok)?.length || 0;
      
      if (successCount > 0) {
        addNotification(`Successfully synced ${successCount} game${successCount === 1 ? '' : 's'} to Google Calendar`, "success");
      }
      if (failCount > 0) {
        addNotification(`Failed to sync ${failCount} game${failCount === 1 ? '' : 's'}`, "error");
      }
    },
    onError: () => {
      addNotification("Failed to sync games to Google Calendar", "error");
    },
  });

  return (
    <button
      onClick={() => {
        trackEvent("Calendar Sync All Clicked", {
          source: "calendar_sync_button",
          action: "sync_all_to_calendar",
        });
        mutation.mutate();
      }}
      disabled={mutation.isPending}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-gray-700 transition disabled:opacity-50"
    >
      {mutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Calendar size={18} />}
      Sync All to Calendar
    </button>
  );
}
