import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    const opponent = await prisma.opponent.update({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: opponent,
    });
  } catch (error) {
    console.error("Error updating opponent:", error);
    return NextResponse.json({ error: "Failed to update opponent" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    await prisma.opponent.delete({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting opponent:", error);
    return NextResponse.json({ error: "Failed to delete opponent" }, { status: 500 });
  }
}
