import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

// GET - List all calendar group mappings for the user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId: session.user.id },
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
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
        userId: session.user.id,
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

// DELETE - Delete all mappings (for bulk operations)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing mapping ID" }, { status: 400 });
    }

    // Delete specific mapping (scoped by user)
    const result = await prisma.calendarGroupMapping.deleteMany({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Mapping not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting calendar group mapping:", error);
    return NextResponse.json({ error: "Failed to delete calendar group mapping" }, { status: 500 });
  }
}
