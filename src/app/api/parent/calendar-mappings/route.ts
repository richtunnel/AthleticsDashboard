import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { z } from "zod";

// Validation schema
const mappingSchema = z.object({
  columnName: z.string().min(1, "Sport is required"),
  columnValue: z.string().min(1, "Level is required"),
  googleCalendarId: z.string().min(1, "Calendar ID is required"),
  googleCalendarName: z.string().min(1, "Calendar name is required"),
});

/**
 * GET /api/parent/calendar-mappings
 * Returns calendar group mappings for parent dashboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getParentSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Use existing CalendarGroupMapping table for parent
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      mappings: mappings.map(m => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[API] Error fetching calendar mappings:", error);
    return NextResponse.json(
      { error: "Failed to fetch mappings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/parent/calendar-mappings
 * Creates a new calendar group mapping for parent dashboard
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = mappingSchema.parse(body);

    // Check for existing mapping
    const existing = await prisma.calendarGroupMapping.findFirst({
      where: {
        userId: user.id,
        columnName: validatedData.columnName,
        columnValue: validatedData.columnValue,
      },
    });

    if (existing) {
      // Update existing
      const mapping = await prisma.calendarGroupMapping.update({
        where: { id: existing.id },
        data: {
          googleCalendarId: validatedData.googleCalendarId,
          googleCalendarName: validatedData.googleCalendarName,
        },
      });
      
      return NextResponse.json({
        mapping: {
          ...mapping,
          createdAt: mapping.createdAt.toISOString(),
          updatedAt: mapping.updatedAt.toISOString(),
        },
      });
    }

    // Create new mapping
    const mapping = await prisma.calendarGroupMapping.create({
      data: {
        userId: user.id,
        columnName: validatedData.columnName,
        columnValue: validatedData.columnValue,
        googleCalendarId: validatedData.googleCalendarId,
        googleCalendarName: validatedData.googleCalendarName,
      },
    });

    return NextResponse.json({
      mapping: {
        ...mapping,
        createdAt: mapping.createdAt.toISOString(),
        updatedAt: mapping.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    console.error("[API] Error creating calendar mapping:", error);
    return NextResponse.json(
      { error: "Failed to create mapping" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/parent/calendar-mappings
 * Deletes a calendar group mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getParentSession();
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const mappingId = searchParams.get("id");

    if (!mappingId) {
      return NextResponse.json(
        { error: "Mapping ID is required" },
        { status: 400 }
      );
    }

    // Verify ownership
    const mapping = await prisma.calendarGroupMapping.findFirst({
      where: {
        id: mappingId,
        userId: user.id,
      },
    });

    if (!mapping) {
      return NextResponse.json(
        { error: "Mapping not found" },
        { status: 404 }
      );
    }

    await prisma.calendarGroupMapping.delete({
      where: { id: mappingId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting calendar mapping:", error);
    return NextResponse.json(
      { error: "Failed to delete mapping" },
      { status: 500 }
    );
  }
}
