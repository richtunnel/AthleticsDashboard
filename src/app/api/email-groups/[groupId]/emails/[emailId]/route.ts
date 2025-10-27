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

export async function DELETE(_request: NextRequest, { params }: { params: { groupId: string; emailId: string } }) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || !session.user.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId, emailId } = params;

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
