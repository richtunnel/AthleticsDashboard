import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

type UpdateUserBody = {
  schoolName?: string;
  teamName?: string;
  schoolAddress?: string;
  schoolEmail?: string | null;
  role?: string;
  plan?: string;
  donationAmount?: number;
  parentInfo?: {
    schoolId?: string;
    schoolName?: string;
    sportId?: string;
    sportName?: string;
    level?: string;
    selectedCoachIds?: string[];
  };
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  // Return 405 Method Not Allowed for GET requests
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify user exists in database and get current role
  const existingUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  });

  if (!existingUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = (await req.json()) as UpdateUserBody;
  const { schoolName, teamName, schoolAddress, schoolEmail, role, plan, donationAmount, parentInfo } = body;

  const updateData: Prisma.UserUpdateInput = {};
  let schoolEmailValue: string | null | undefined = undefined;

  if (schoolName !== undefined) updateData.schoolName = schoolName.trim() || null;
  if (teamName !== undefined) updateData.teamName = teamName.trim() || null;
  if (schoolAddress !== undefined) updateData.schoolAddress = schoolAddress.trim() || null;

  // Guard: Do not allow changing role from SUPER_ADMIN or ATHLETIC_DIRECTOR to PARENT.
  // These users gain parent access via parentAthleteLink records, not role changes.
  if (role !== undefined) {
    const isProtectedRole = existingUser.role === "SUPER_ADMIN" || existingUser.role === "ATHLETIC_DIRECTOR";
    const isDowngradeToParent = role === "PARENT";
    if (!(isProtectedRole && isDowngradeToParent)) {
      updateData.role = role as any;
    }
  }

  if (plan !== undefined) updateData.plan = plan;

  if (schoolEmail !== undefined) {
    const trimmed = typeof schoolEmail === "string" ? schoolEmail.trim() : "";

    if (trimmed && !EMAIL_REGEX.test(trimmed)) {
      return NextResponse.json({ error: "Invalid school email format" }, { status: 400 });
    }

    schoolEmailValue = trimmed || null;
  }

  const ops: Prisma.PrismaPromise<unknown>[] = [];

  if (Object.keys(updateData).length > 0) {
    ops.push(
      prisma.user.update({
        where: { email: session.user.email },
        data: updateData,
      }),
    );
  }

  if (schoolEmailValue !== undefined) {
    ops.push(
      prisma.$executeRaw`
        UPDATE "User"
        SET "schoolEmail" = ${schoolEmailValue}
        WHERE email = ${session.user.email}
      `,
    );
  }

  if (ops.length === 0) {
    return NextResponse.json({ success: true });
  }

  await prisma.$transaction(ops);

  return NextResponse.json({ success: true });
}
