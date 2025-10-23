"use server";

import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/utils/authOptions";
import { calendarService, type UpcomingCalendarEvent } from "@/lib/services/calendar.service";

export async function getUpcomingCalendarEvents(daysAhead = 3): Promise<
  | { success: true; events: UpcomingCalendarEvent[] }
  | { success: false; error: string }
> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const events = await calendarService.getUpcomingEvents(session.user.id, daysAhead);
    return { success: true, events };
  } catch (error) {
    console.error("Failed to fetch upcoming calendar events:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}
