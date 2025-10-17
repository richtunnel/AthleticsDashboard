import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const body = await request.json();

    // ✅ VALIDATE: Check ownership first
    const existingOpponent = await prisma.opponent.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!existingOpponent) {
      return NextResponse.json({ success: false, error: "Opponent not found" }, { status: 404 });
    }

    // ✅ Now update using only the unique id
    const opponent = await prisma.opponent.update({
      where: { id },
      data: body,
    });

    return NextResponse.json({
      success: true,
      data: opponent,
    });
  } catch (error) {
    console.error("Error updating opponent:", error);
    return NextResponse.json({ success: false, error: "Failed to update opponent" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // ✅ VALIDATE: Check ownership first
    const opponent = await prisma.opponent.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
      },
    });

    if (!opponent) {
      return NextResponse.json({ success: false, error: "Opponent not found" }, { status: 404 });
    }

    // ✅ Now delete using only the unique id
    await prisma.opponent.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting opponent:", error);
    return NextResponse.json({ success: false, error: "Failed to delete opponent" }, { status: 500 });
  }
}
