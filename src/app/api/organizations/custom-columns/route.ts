import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const session = await requireAuth();
    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        customColumns: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), { status: 404 });
    }
    return new Response(JSON.stringify({ data: organization.customColumns }));
  } catch (error) {
    console.error("Error fetching custom columns:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch custom columns" }), { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { name, type = "TEXT" } = await request.json();

    if (!name?.trim()) {
      return new Response(JSON.stringify({ error: "Column name is required" }), { status: 400 });
    }

    const validTypes = ["TEXT", "TIME", "DROPDOWN", "DATETIME"];
    if (!validTypes.includes(type)) {
      return new Response(JSON.stringify({ error: "Invalid column type" }), { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: session.user.organizationId },
      include: {
        customColumns: true,
      },
    });

    if (!organization) {
      return new Response(JSON.stringify({ error: "Organization not found" }), { status: 404 });
    }

    if (organization.customColumns.length >= 50) {
      return new Response(JSON.stringify({ error: "Maximum of 50 custom columns reached" }), { status: 400 });
    }

    // Check for duplicate column name
    const existingColumn = organization.customColumns.find((col) => col.name.toLowerCase() === name.trim().toLowerCase());
    if (existingColumn) {
      return new Response(JSON.stringify({ error: "A column with this name already exists" }), { status: 400 });
    }

    const newColumn = await prisma.customColumn.create({
      data: {
        name: name.trim(),
        type: type as any,
        organizationId: organization.id,
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

    // ✅ VALIDATE: Is this a custom column or built-in?
    // Built-in columns don't have entries in CustomColumn table
    const column = await prisma.customColumn.findUnique({
      where: { id: columnId },
    });

    if (!column) {
      return new Response(JSON.stringify({ error: "Column not found or cannot be deleted (built-in column)" }), { status: 404 });
    }

    if (column.organizationId !== session.user.organizationId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403 });
    }

    // Delete the column
    await prisma.customColumn.delete({
      where: { id: columnId },
    });

    // Clean up customData in all relevant games with a single query
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
