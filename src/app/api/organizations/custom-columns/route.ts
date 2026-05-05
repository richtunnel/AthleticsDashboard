import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const workbookId = searchParams.get("workbookId");

    const customColumns = await prisma.customColumn.findMany({
      where: {
        organizationId: session.user.organizationId,
        OR: [
          { workbookId: workbookId || null },
          { workbookId: null }
        ]
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return new Response(JSON.stringify({ data: customColumns }));
  } catch (error) {
    console.error("Error fetching custom columns:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch custom columns" }), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { name, type = "TEXT", workbookId } = await request.json();

    if (!name?.trim()) {
      return new Response(JSON.stringify({ error: "Column name is required" }), { status: 400 });
    }

    const validTypes = ["TEXT", "TIME", "DROPDOWN", "DATETIME"];
    if (!validTypes.includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid column type" }), { status: 400 });
    }

    // Check for duplicate column name within the same scope
    const existingColumn = await prisma.customColumn.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: {
          equals: name.trim(),
          mode: 'insensitive'
        },
        workbookId: workbookId || null
      }
    });

    if (existingColumn) {
      return new Response(JSON.stringify({ error: "A column with this name already exists in this worksheet" }), { status: 400 });
    }

    const newColumn = await prisma.customColumn.create({
      data: {
        name: name.trim(),
        type: type as any,
        organizationId: session.user.organizationId,
        workbookId: workbookId || null
      },
    });

    return new Response(JSON.stringify({ data: newColumn }));
  } catch (error) {
    console.error("Error creating custom column:", error);
    return new Response(JSON.stringify({ error: "Failed to create custom column" }), { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const columnId = searchParams.get("id");

    if (!columnId) {
      return new Response(JSON.stringify({ error: "Column ID is required" }), { status: 400 });
    }

    const column = await prisma.customColumn.findUnique({
      where: { id: columnId },
    });

    if (!column) {
      return new Response(JSON.stringify({ error: "Column not found or cannot be deleted" }), { status: 404 });
    }

    if (column.organizationId !== session.user.organizationId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    // Delete the column
    await prisma.customColumn.delete({
      where: { id: columnId },
    });

    // Clean up customData in all relevant games with a single query
    // We filter by organization teams to ensure security
    await prisma.$executeRaw`
      UPDATE "Game"
      SET "customData" = "customData" - ${columnId}
      WHERE "homeTeamId" IN (
        SELECT "id" FROM "Team" WHERE "organizationId" = ${session.user.organizationId}
      )
      AND "customData" ? ${columnId}
    `;

    return new Response(JSON.stringify({ success: true }));
  } catch (error) {
    console.error("Error deleting custom column:", error);
    return new Response(JSON.stringify({ error: "Failed to delete custom column" }), { status: 500 });
  }
}
