import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { ensureParentCode } from "@/lib/utils/parentCode";

export async function GET() {
  try {
    const session = await getParentSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, phone: true, parentCode: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Lazily assign a parentCode if this parent doesn't have one yet
    const parentCode = user.parentCode ?? (await ensureParentCode(user.id, user.name).catch(() => null));

    return NextResponse.json({ name: user.name, email: user.email, phone: user.phone, parentCode });
  } catch (error) {
    console.error("[API] Error fetching parent profile:", error);
    return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getParentSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, email, phone } = body;

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== "string" || !emailRegex.test(email.trim())) {
        return NextResponse.json({ error: "A valid email address is required" }, { status: 400 });
      }
      if (email.trim().toLowerCase() !== user.email.toLowerCase()) {
        const existing = await prisma.user.findUnique({
          where: { email: email.trim() },
          select: { id: true },
        });
        if (existing && existing.id !== user.id) {
          return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
        }
      }
    }

    const normalizedPhone =
      phone === "" || phone === null ? null : typeof phone === "string" ? phone.trim() || null : undefined;

    if (normalizedPhone) {
      const existingPhone = await prisma.user.findFirst({
        where: { phone: normalizedPhone, NOT: { id: user.id } },
        select: { id: true },
      });
      if (existingPhone) {
        return NextResponse.json({ error: "Phone number is already in use" }, { status: 409 });
      }
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email.trim();
    if (phone !== undefined) updateData.phone = normalizedPhone ?? null;

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: { name: true, email: true, phone: true },
    });

    return NextResponse.json({ name: updated.name, email: updated.email, phone: updated.phone });
  } catch (error: unknown) {
    console.error("[API] Error updating parent profile:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}
