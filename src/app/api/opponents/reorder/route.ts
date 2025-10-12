import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { reorderedOpponents } = await request.json();

    if (!reorderedOpponents || !Array.isArray(reorderedOpponents)) {
      return NextResponse.json({ error: "Invalid reordered opponents data" }, { status: 400 });
    }

    // Update all opponents with their new sort orders in a transaction
    const updatePromises = reorderedOpponents.map((opponent: any) =>
      prisma.opponent.update({
        where: {
          id: opponent.id,
          organizationId: session.user.organizationId, // Ensure user owns this opponent
        },
        data: { sortOrder: opponent.sortOrder },
      })
    );

    await prisma.$transaction(updatePromises);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering opponents:", error);
    return NextResponse.json({ error: "Failed to reorder opponents" }, { status: 500 });
  }
}
