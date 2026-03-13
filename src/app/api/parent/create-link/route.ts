import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * POST /api/parent/create-link
 * Creates a ParentAthleteLink for the authenticated parent user.
 *
 * Expected body:
 *   schoolId       – Organization ID (required)
 *   athleteName     – Child's name (required)
 *   sport           – Sport name, e.g. "Basketball" (optional)
 *   gradeLevel      – e.g. "Varsity", "Junior Varsity" (optional)
 *   teamName        – Team name (optional)
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    // Get existing user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
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
    const { schoolId, athleteName, sport, gradeLevel, teamName } = body;

    // Validate required fields
    if (!schoolId || typeof schoolId !== "string") {
      return NextResponse.json({ error: "School ID is required" }, { status: 400 });
    }

    if (!athleteName || typeof athleteName !== "string") {
      return NextResponse.json({ error: "Child's name is required" }, { status: 400 });
    }

    // Verify the school (Organization) exists
    const school = await prisma.organization.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });

    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    // Check if link already exists for this child at this school
    const existingLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId,
        athleteName,
      },
    });

    if (existingLink) {
      // Link already exists, return success with existing link
      return NextResponse.json({
        success: true,
        linkId: existingLink.id,
        message: "Parent link already exists",
      });
    }

    // Create the parent athlete link using actual schema fields
    const link = await prisma.parentAthleteLink.create({
      data: {
        parentUserId: user.id,
        schoolId,
        athleteName,
        sport: sport || null,
        gradeLevel: gradeLevel || null,
        teamName: teamName || null,
        status: "ACTIVE",
      },
    });

    // Create ConnectedParent entry for the AD's dashboard
    try {
      await prisma.connectedParent.upsert({
        where: { email: user.email! },
        create: {
          parentUserId: user.id,
          email: user.email!,
          fullName: user.name || athleteName,
          schoolId,
          calendarSynced: false,
          membershipStatus: "TRIALING",
        },
        update: {
          schoolId,
          fullName: user.name || athleteName,
        },
      });
    } catch (err) {
      // Non-critical — don't fail the whole request if ConnectedParent fails
      console.warn("[API] Failed to create ConnectedParent entry:", err);
    }

    // Create a free trial subscription
    const trialEnd = new Date();
    trialEnd.setMonth(trialEnd.getMonth() + 1); // 1 month free trial

    try {
      await prisma.parentSubscription.create({
        data: {
          parentUserId: user.id,
          parentAthleteLinkId: link.id,
          status: "TRIALING",
          subscriptionType: "parent_free",
          expiresAt: trialEnd,
        },
      });
    } catch (err) {
      // Non-critical — don't fail if subscription creation fails
      console.warn("[API] Failed to create ParentSubscription:", err);
    }

    return NextResponse.json({
      success: true,
      linkId: link.id,
      message: "Parent link created successfully",
    });
  } catch (error: any) {
    console.error("[API] Error creating parent link:", error);
    return NextResponse.json({ error: "Failed to create parent link" }, { status: 500 });
  }
}
