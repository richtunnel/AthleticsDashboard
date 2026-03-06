import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";
import { z } from "zod";

// Validation schema
const createLinkSchema = z.object({
  schoolId: z.string().min(1, "School ID is required"),
  schoolName: z.string().min(1, "School name is required"),
  athleticDirectorId: z.string().min(1, "Athletic Director ID is required"),
  athleticDirectorName: z.string().min(1, "Athletic Director name is required"),
  sportName: z.string().min(1, "Sport name is required"),
  sportLevel: z.string().min(1, "Sport level is required"),
  childName: z.string().min(1, "Child name is required"),
  childGrade: z.string().optional(),
  errors: z.any().optional(),
});

/**
 * POST /api/parent/create-link
 * Creates a ParentAthleteLink for the authenticated parent user
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    // Get or create parent user
    let user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      // If user doesn't exist, they need to sign up first
      return NextResponse.json({ error: "Please sign up first to create a parent link" }, { status: 400 });
    }

    // Update user role to PARENT if not already
    if (user.role !== "PARENT") {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: "PARENT" },
      });
    }

    const body = await request.json();
    const validatedData = createLinkSchema.parse(body);

    // Check if link already exists
    const existingLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: validatedData.schoolId,
        sportName: validatedData.sportName,
        sportLevel: validatedData.sportLevel,
        active: true,
      },
    });

    if (existingLink) {
      return NextResponse.json({ error: "This parent link already exists" }, { status: 400 });
    }

    // Create the parent athlete link
    const link = await prisma.parentAthleteLink.create({
      data: {
        parentUserId: user.id,
        childName: validatedData.childName,
        childGrade: validatedData.childGrade,
        sportName: validatedData.sportName,
        sportLevel: validatedData.sportLevel,
        schoolId: validatedData.schoolId,
        schoolName: validatedData.schoolName,
        athleticDirectorId: validatedData.athleticDirectorId,
        athleticDirectorName: validatedData.athleticDirectorName,
        confirmed: true, // They confirmed during onboarding
      },
    });

    // Create ConnectedParent entry for the AD's dashboard
    await prisma.connectedParent.create({
      data: {
        parentUserId: user.id,
        parentUserName: user.name,
        parentEmail: user.email,
        schoolId: validatedData.schoolId,
        sportName: validatedData.sportName,
        sportLevel: validatedData.sportLevel,
        calendarSynced: false,
        membershipStatus: "TRIALING",
      },
    });

    // Create a free trial subscription
    const trialEnd = new Date();
    trialEnd.setMonth(trialEnd.getMonth() + 1); // 1 month free trial

    await prisma.parentSubscription.create({
      data: {
        parentUserId: user.id,
        parentAthleteLinkId: link.id,
        status: "TRIALING",
        plan: "parent_power",
        trialEnd,
      },
    });

    return NextResponse.json({
      success: true,
      linkId: link.id,
      message: "Parent link created successfully",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 });
    }

    console.error("[API] Error creating parent link:", error);
    return NextResponse.json({ error: "Failed to create parent link" }, { status: 500 });
  }
}
