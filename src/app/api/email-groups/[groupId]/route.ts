import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

const emailGroupInclude = {
  emails: {
    select: {
      id: true,
      email: true,
    },
    orderBy: {
      email: "asc" as const,
    },
  },
  _count: {
    select: {
      emails: true,
    },
  },
};

function normalizeGroupName(name: string) {
  return name.trim();
}

async function ensureGroupAccess(groupId: string, organizationId: string) {
  return prisma.emailGroup.findFirst({
    where: {
      id: groupId,
      organizationId,
    },
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { groupId: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groupId = params.groupId;

  if (!groupId) {
    return NextResponse.json({ error: "Group ID required" }, { status: 400 });
  }

  const existing = await ensureGroupAccess(groupId, session.user.organizationId);

  if (!existing) {
    return NextResponse.json({ error: "Email group not found" }, { status: 404 });
  }

  try {
    const { name } = await request.json();

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Group name is required" }, { status: 400 });
    }

    const normalizedName = normalizeGroupName(name);

    if (!normalizedName) {
      return NextResponse.json({ error: "Group name cannot be empty" }, { status: 400 });
    }

    await prisma.emailGroup.update({
      where: { id: groupId },
      data: { name: normalizedName },
    });

    const updated = await prisma.emailGroup.findUnique({
      where: { id: groupId },
      include: emailGroupInclude,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating email group", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An email group with this name already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to update email group" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { groupId: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const groupId = params.groupId;

  if (!groupId) {
    return NextResponse.json({ error: "Group ID required" }, { status: 400 });
  }

  const existing = await ensureGroupAccess(groupId, session.user.organizationId);

  if (!existing) {
    return NextResponse.json({ error: "Email group not found" }, { status: 404 });
  }

  try {
    await prisma.emailGroup.delete({ where: { id: groupId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting email group", error);
    return NextResponse.json({ error: "Failed to delete email group" }, { status: 500 });
  }
}
