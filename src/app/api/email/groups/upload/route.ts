import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/utils/authOptions";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId, emails } = await request.json();
  if (!groupId || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "Invalid data" }, { status: 400 });
  }

  // Validate group belongs to user
  const group = await prisma.emailGroup.findUnique({
    where: { id: groupId, userId: session.user.id },
  });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  // Bulk insert emails (Prisma supports createMany)
  await prisma.emailAddress.createMany({
    data: emails.map((email) => ({ email, groupId })),
    skipDuplicates: true, // Avoid duplicates in the group
  });

  return NextResponse.json({ message: "Emails uploaded successfully" });
}
