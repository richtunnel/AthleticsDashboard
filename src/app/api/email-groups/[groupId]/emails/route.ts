import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/database/prisma";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";
import { MAX_EMAILS_PER_GROUP } from "@/lib/services/email-import.service";

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
  const session = await getAnySession();

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

  let normalizedEmails: string[] = [];
  
  try {
    const { emails } = await request.json();

    if (!Array.isArray(emails)) {
      return NextResponse.json({ error: "Emails must be an array" }, { status: 400 });
    }

    normalizedEmails = normalizeEmailList(emails);

    if (normalizedEmails.length === 0) {
      return NextResponse.json({ error: "No valid email addresses provided" }, { status: 400 });
    }

    const storageCheckResult = await checkStorageBeforeWrite({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      data: { emails: normalizedEmails },
    });

    if (storageCheckResult) {
      return storageCheckResult;
    }

    // Check for existing emails to provide feedback on duplicates
    const existingEmails = await prisma.emailAddress.findMany({
      where: {
        groupId,
        email: {
          in: normalizedEmails,
        },
      },
      select: {
        email: true,
      },
    });

    const existingEmailSet = new Set(existingEmails.map((e) => e.email));
    const newEmails = normalizedEmails.filter((email) => !existingEmailSet.has(email));
    const duplicateEmails = normalizedEmails.filter((email) => existingEmailSet.has(email));

    // Per-group cap: max 500 emails per campaign group
    const currentGroupCount = await prisma.emailAddress.count({ where: { groupId } });
    const availableSlots = Math.max(0, MAX_EMAILS_PER_GROUP - currentGroupCount);
    if (availableSlots <= 0) {
      return NextResponse.json({
        error: `This campaign group has reached the ${MAX_EMAILS_PER_GROUP}-email limit. Remove existing emails to add new ones.`,
      }, { status: 400 });
    }
    const emailsToCreate = newEmails.slice(0, availableSlots);
    const limitSkipped = newEmails.length - emailsToCreate.length;

    // Only create emails that don't already exist and fit within the limit
    if (emailsToCreate.length > 0) {
      await prisma.emailAddress.createMany({
        data: emailsToCreate.map((email) => ({ email, groupId })),
      });
    }

    const updated = await prisma.emailGroup.findUnique({
      where: { id: groupId },
      include: emailGroupInclude,
    });

    if (!updated) {
      return NextResponse.json({ error: "Email group not found after update" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      addedCount: emailsToCreate.length,
      duplicateCount: duplicateEmails.length,
      duplicates: duplicateEmails,
      limitSkipped,
      groupLimit: MAX_EMAILS_PER_GROUP,
    });
  } catch (error) {
    console.error("Error adding emails to group", error);

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Handle duplicate emails gracefully (compound unique constraint violation)
      const updated = await prisma.emailGroup.findUnique({
        where: { id: groupId },
        include: emailGroupInclude,
      });

      if (!updated) {
        return NextResponse.json({ error: "Email group not found" }, { status: 404 });
      }

      // Return updated group with duplicate info
      return NextResponse.json({
        ...updated,
        addedCount: 0,
        duplicateCount: normalizedEmails.length,
        duplicates: normalizedEmails,
      });
    }

    return NextResponse.json({ error: "Failed to add emails to group" }, { status: 500 });
  }
}
