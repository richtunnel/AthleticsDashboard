import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { getParentSession } from "@/lib/utils/parentSession";
import { prisma } from "@/lib/database/prisma";

/** Resolve userId from AD or parent session */
async function resolveUserId(): Promise<string | null> {
  const adSession = await getAnySession();
  if (adSession?.user?.id) return adSession.user.id;
  const parentSession = await getParentSession();
  return (parentSession?.user as any)?.id ?? null;
}

// GET - List all calendar group mappings for the user
export async function GET(request: NextRequest) {
  try {
    const userId = await resolveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
      orderBy: [{ columnName: "asc" }, { columnValue: "asc" }],
    });

    return NextResponse.json({ mappings });
  } catch (error) {
    console.error("Error fetching calendar group mappings:", error);
    return NextResponse.json({ error: "Failed to fetch calendar group mappings" }, { status: 500 });
  }
}

// POST - Create a new calendar group mapping
export async function POST(request: NextRequest) {
  try {
    const userId = await resolveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { columnName, columnValue, googleCalendarId, googleCalendarName } = body;

    const trimmedColumnName = typeof columnName === "string" ? columnName.trim() : "";
    const trimmedColumnValue = typeof columnValue === "string" ? columnValue.trim() : "";
    const trimmedCalendarId = typeof googleCalendarId === "string" ? googleCalendarId.trim() : "";
    const trimmedCalendarName = typeof googleCalendarName === "string" ? googleCalendarName.trim() : "";

    if (!trimmedColumnName || !trimmedColumnValue || !trimmedCalendarId || !trimmedCalendarName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const mapping = await prisma.calendarGroupMapping.create({
      data: {
        userId,
        columnName: trimmedColumnName,
        columnValue: trimmedColumnValue,
        googleCalendarId: trimmedCalendarId,
        googleCalendarName: trimmedCalendarName,
      },
    });

    return NextResponse.json({ mapping });
  } catch (error: any) {
    console.error("Error creating calendar group mapping:", error);

    // Handle unique constraint violation
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A mapping for this column and value already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create calendar group mapping" }, { status: 500 });
  }
}

// DELETE - Remove mapping(s)
//
// Two modes:
//   ?id=<mappingId>           → delete a single mapping
//   ?calendarId=<calendarId>  → delete EVERY mapping that routes to the given
//                               Google Calendar. Used by the "Disconnect this
//                               calendar" action on the Calendar Sync page so
//                               the AD/parent can stop routing games to a
//                               specific (often shared/secondary) calendar
//                               without hunting down each individual mapping.
export async function DELETE(request: NextRequest) {
  try {
    const userId = await resolveUserId();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const calendarId = searchParams.get("calendarId");

    if (!id && !calendarId) {
      return NextResponse.json(
        { error: "Missing mapping ID or calendarId" },
        { status: 400 }
      );
    }

    const where = id
      ? { id, userId }
      : { googleCalendarId: calendarId!, userId };

    const result = await prisma.calendarGroupMapping.deleteMany({ where });

    if (result.count === 0) {
      return NextResponse.json(
        { error: id ? "Mapping not found" : "No mappings found for that calendar" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, deleted: result.count });
  } catch (error) {
    console.error("Error deleting calendar group mapping:", error);
    return NextResponse.json({ error: "Failed to delete calendar group mapping" }, { status: 500 });
  }
}
