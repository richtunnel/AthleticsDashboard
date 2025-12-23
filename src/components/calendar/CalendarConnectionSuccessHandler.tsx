"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Client component that handles calendar connection success
 * Invalidates React Query cache when calendar is connected
 * Works with old flow that redirects to /dashboard/settings?calendar=connected
 */
export function CalendarConnectionSuccessHandler() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Check if calendar was just connected
    if (searchParams.get("calendar") === "connected") {
      // Invalidate all calendar-related queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["googleCalendarStatus"] });
      queryClient.invalidateQueries({ queryKey: ["googleCalendars"] });
      queryClient.invalidateQueries({ queryKey: ["calendarGroupMappings"] });
    }
  }, [searchParams, queryClient]);

  return null; // This component doesn't render anything
}
