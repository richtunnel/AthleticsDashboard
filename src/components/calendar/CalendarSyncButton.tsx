"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";
import { FaGoogle } from "react-icons/fa";

interface CalendarSyncButtonProps {
  gameId: string;
  isSynced?: boolean;
}

export function CalendarSyncButton({ gameId, isSynced = false }: CalendarSyncButtonProps) {
  const queryClient = useQueryClient();
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
    },
  });

  const handleClick = () => {
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
        synced ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      title={synced ? "Synced to Google Calendar" : "Sync to Google Calendar"}
    >
      {isLoading ? <RefreshCw size={16} className="animate-spin" /> : <Calendar size={16} />}
      {synced ? "Synced" : "Sync"}
    </button>
  );
}

export function SyncAllButton() {
  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/calendar/sync-all", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to sync all");
      return res.json();
    },
  });

  return (
    <button
      onClick={() => mutation.mutate()}
      disabled={mutation.isPending}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
    >
      {mutation.isPending ? <RefreshCw size={18} className="animate-spin" /> : <Calendar size={18} />}
      Sync All to Calendar
    </button>
  );
}
