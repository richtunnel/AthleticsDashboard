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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmailList(emails: string[]): string[] {
  const seen = new Set<string>();

  for (const rawEmail of emails) {
    if (typeof rawEmail !== "string") {
      continue;
    }

    const email = rawEmail.trim().toLowerCase();

    if (!email || !EMAIL_REGEX.test(email)) {
      continue;
    }

    seen.add(email);
  }

  return Array.from(seen);
}

async function ensureGroupAccess(groupId: string, organizationId: string) {
  return prisma.emailGroup.findFirst({
    where: {
      id: groupId,
      organizationId,
    },
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Await params to ensure dynamic route parameters are resolved
  const { groupId } = await params;

  if (!groupId) {
    return NextResponse.json({ error: "Group ID required" }, { status: 400 });
  }

  const existing = await ensureGroupAccess(groupId, session.user.organizationId);

  if (!existing) {
    return NextResponse.json({ error: "Email group not found" }, { status: 404 });
  }

  try {
    const { emails } = await request.json();

    if (!Array.isArray(emails)) {
      return NextResponse.json({ error: "Emails must be an array" }, { status: 400 });
    }

    const normalizedEmails = normalizeEmailList(emails);

    if (normalizedEmails.length === 0) {
      return NextResponse.json({ error: "No valid email addresses provided" }, { status: 400 });
    }

    await prisma.emailAddress.createMany({
      data: normalizedEmails.map((email) => ({ email, groupId })),
      skipDuplicates: true,
    });

    const updated = await prisma.emailGroup.findUnique({
      where: { id: groupId },
      include: emailGroupInclude,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error adding emails to group", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Handle duplicate emails gracefully
      const updated = await prisma.emailGroup.findUnique({
        where: { id: groupId },
        include: emailGroupInclude,
      });

      return NextResponse.json(updated);
    }

    return NextResponse.json({ error: "Failed to add emails to group" }, { status: 500 });
  }
}
