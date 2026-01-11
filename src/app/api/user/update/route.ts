import type { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

type UpdateUserBody = {
  schoolName?: string;
  teamName?: string;
  schoolAddress?: string;
  schoolEmail?: string | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as UpdateUserBody;
  const { schoolName, teamName, schoolAddress, schoolEmail } = body;

  const updateData: Prisma.UserUpdateInput = {};

  if (schoolName !== undefined) updateData.schoolName = schoolName.trim() || null;
  if (teamName !== undefined) updateData.teamName = teamName.trim() || null;
  if (schoolAddress !== undefined) updateData.schoolAddress = schoolAddress.trim() || null;

  if (schoolEmail !== undefined) {
    const trimmed = typeof schoolEmail === "string" ? schoolEmail.trim() : "";

    if (trimmed && !EMAIL_REGEX.test(trimmed)) {
      return NextResponse.json({ error: "Invalid school email format" }, { status: 400 });
    }

    updateData.schoolEmail = trimmed || null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ success: true });
  }

  await prisma.user.update({
    where: { email: session.user.email },
    data: updateData,
  });

  return NextResponse.json({ success: true });
}
