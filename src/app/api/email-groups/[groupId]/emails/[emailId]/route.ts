import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ groupId: string; emailId: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId, emailId } = await params;

  if (!groupId || !emailId) {
    return NextResponse.json({ error: "Group ID and Email ID are required" }, { status: 400 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { email } = body;

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
  }

  const emailRecord = await prisma.emailAddress.findFirst({
    where: {
      id: emailId,
      groupId,
      group: { organizationId: session.user.organizationId },
    },
  });

  if (!emailRecord) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const existingEmail = await prisma.emailAddress.findFirst({
    where: {
      groupId,
      email: normalizedEmail,
      id: { not: emailId },
    },
  });

  if (existingEmail) {
    return NextResponse.json({ error: "This email already exists in the group" }, { status: 400 });
  }

  try {
    await prisma.emailAddress.update({
      where: { id: emailId },
      data: { email: normalizedEmail },
    });

    const updated = await prisma.emailGroup.findUnique({
      where: { id: groupId },
      include: emailGroupInclude,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating email in group", error);
    return NextResponse.json({ error: "Failed to update email in group" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ groupId: string; emailId: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId, emailId } = await params;

  if (!groupId || !emailId) {
    return NextResponse.json({ error: "Group ID and Email ID are required" }, { status: 400 });
  }

  const emailRecord = await prisma.emailAddress.findFirst({
    where: {
      id: emailId,
      groupId,
      group: { organizationId: session.user.organizationId },
    },
  });

  if (!emailRecord) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  try {
    await prisma.emailAddress.delete({ where: { id: emailId } });

    const updated = await prisma.emailGroup.findUnique({
      where: { id: groupId },
      include: emailGroupInclude,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error removing email from group", error);
    return NextResponse.json({ error: "Failed to remove email from group" }, { status: 500 });
  }
}
