import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { Prisma } from "@prisma/client";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";

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

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const groups = await prisma.emailGroup.findMany({
      where: { organizationId: session.user.organizationId },
      orderBy: { createdAt: "desc" },
      include: emailGroupInclude,
    });

    return NextResponse.json(groups);
  } catch (error) {
    console.error("Error fetching email groups", error);
    return NextResponse.json({ error: "Failed to fetch email groups" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const storageCheckResult = await checkStorageBeforeWrite({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      data: { name: normalizedName },
    });

    if (storageCheckResult) {
      return storageCheckResult;
    }

    const created = await prisma.emailGroup.create({
      data: {
        name: normalizedName,
        userId: session.user.id,
        organizationId: session.user.organizationId,
      },
    });

    const group = await prisma.emailGroup.findUnique({
      where: { id: created.id },
      include: emailGroupInclude,
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("Error creating email group", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An email group with this name already exists" }, { status: 409 });
    }

    return NextResponse.json({ error: "Failed to create email group" }, { status: 500 });
  }
}
