import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";

/**
 * POST /api/parent/create-link
 * Creates a ParentAthleteLink for the authenticated parent user.
 *
 * Expected body:
 *   schoolId       – School entity ID or Organization ID (required)
 *   athleteName     – Child's name (required)
 *   sport           – Sport name, e.g. "Basketball" (optional)
 *   gradeLevel      – e.g. "Varsity", "Junior Varsity" (optional)
 *   teamName        – Team name (optional)
 */
export async function POST(request: NextRequest) {
  const session = await getParentSession();

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

    // Note: Do NOT overwrite the user's role to PARENT here.
    // Users who sign up through the parent flow already get role=PARENT from createUser.
    // Existing users (ADs, coaches, etc.) who also want parent access should keep
    // their primary role — the parent dashboard checks for parentAthleteLink records
    // as a fallback, so they can access both dashboards.

    const body = await request.json();
    const { schoolId, athleteName, sport, gradeLevel, teamName } = body;

    // Validate required fields
    if (!schoolId || typeof schoolId !== "string") {
      return NextResponse.json({ error: "School ID is required" }, { status: 400 });
    }

    if (!athleteName || typeof athleteName !== "string") {
      return NextResponse.json({ error: "Child's name is required" }, { status: 400 });
    }

    // Resolve schoolId: could be a School entity ID or an Organization ID.
    // Try School entity first, fall back to Organization lookup.
    let organizationId = schoolId;
    let schoolEntityId: string | null = null;

    const schoolEntity = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, organizationId: true },
    });

    if (schoolEntity) {
      organizationId = schoolEntity.organizationId;
      schoolEntityId = schoolEntity.id;
    } else {
      // Verify the Organization exists
      const org = await prisma.organization.findUnique({
        where: { id: schoolId },
        select: { id: true },
      });
      if (!org) {
        return NextResponse.json({ error: "School not found" }, { status: 404 });
      }
    }

    // Check if link already exists for this child at this school
    const existingLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: organizationId,
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
        schoolId: organizationId,
        schoolEntityId,
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
          parentUserName: user.name || null,
          schoolId: organizationId,
          schoolEntityId,
          sportName: sport || null,
          sportLevel: gradeLevel || null,
          calendarSynced: false,
          membershipStatus: "TRIALING",
        },
        update: {
          schoolId: organizationId,
          schoolEntityId,
          fullName: user.name || athleteName,
          parentUserName: user.name || null,
          sportName: sport || null,
          sportLevel: gradeLevel || null,
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
