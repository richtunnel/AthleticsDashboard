import { getAnySession } from "@/lib/utils/collaboratorSession";
import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/database/prisma";

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
  const session = await getAnySession();
  if (!session?.user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify user exists in database and get current role + org
  const existingUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true, organizationId: true },
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

  // If school details were updated, create/update the School entity and auto-name the Organization
  const trimmedSchoolName = schoolName?.trim();
  if (trimmedSchoolName && existingUser.organizationId) {
    try {
      // Upsert School record for this organization
      const existingSchool = await prisma.school.findFirst({
        where: { organizationId: existingUser.organizationId },
      });

      if (existingSchool) {
        await prisma.school.update({
          where: { id: existingSchool.id },
          data: {
            name: trimmedSchoolName,
            address: schoolAddress?.trim() || existingSchool.address,
            email: schoolEmailValue !== undefined ? schoolEmailValue : existingSchool.email,
            mascot: teamName?.trim() || existingSchool.mascot,
          },
        });
      } else {
        await prisma.school.create({
          data: {
            name: trimmedSchoolName,
            address: schoolAddress?.trim() || null,
            email: schoolEmailValue !== undefined ? schoolEmailValue : null,
            mascot: teamName?.trim() || null,
            organizationId: existingUser.organizationId,
          },
        });
      }

      // Auto-name Organization to "{schoolName} Organization"
      await prisma.organization.update({
        where: { id: existingUser.organizationId },
        data: { name: `${trimmedSchoolName} Organization` },
      });
    } catch (schoolErr) {
      // Non-critical — don't fail the whole request if School/Org update fails
      console.warn("[API] Failed to update School/Organization:", schoolErr);
    }
  }

  // Enqueue background district lookup when a school address is provided.
  // This is non-blocking — onboarding should not wait for the Census API.
  if (schoolAddress?.trim()) {
    try {
      await prisma.backgroundJob.create({
        data: {
          type:    "SCHOOL_DISTRICT_LOOKUP",
          payload: { userId: existingUser.id, address: schoolAddress.trim() },
          userId:  existingUser.id,
        },
      });
    } catch {
      // Non-critical — job table write failure should not block the response
    }
  }

  return NextResponse.json({ success: true });
}
