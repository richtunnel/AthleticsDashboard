import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { generateUniqueShareCode } from "@/lib/utils/shareCode";

const AD_ROLES = new Set(["ATHLETIC_DIRECTOR", "ASSISTANT_AD", "COACH", "STAFF", "SUPER_ADMIN"]);

async function getShareCodeSession() {
  // Try parent session first (parents and ADs-who-are-also-parents)
  const parentSession = await getParentSession();
  if (parentSession?.user?.email) return parentSession;

  // Fall back to the main AD/collaborator session for the Portal Setup tab
  const mainSession = await getAnySession();
  if (mainSession?.user?.email) return mainSession;

  return null;
}

/**
 * GET /api/parent/share-code
 * Gets or creates the share code for the authenticated user.
 * Accepts both parent sessions and main AD sessions so the Portal Setup
 * tab in the AD dashboard works for all user types.
 */
export async function GET(request: NextRequest) {
  const session = await getShareCodeSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        schoolName: true,
        shareCode: true,
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let shareCode = user.shareCode;

    // Generate a new share code if user doesn't have one
    if (!shareCode) {
      shareCode = await generateUniqueShareCode();

      if (!shareCode) {
        return NextResponse.json({ error: "Failed to generate unique share code" }, { status: 500 });
      }

      // Save the share code to the user
      await prisma.user.update({
        where: { id: user.id },
        data: { shareCode },
      });
    }

    // Build the shareable URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://opletics.com";
    const shareUrl = `${baseUrl}/onboarding/parent-signup?code=${shareCode}`;

    return NextResponse.json({
      shareCode,
      shareUrl,
      userName: user.name,
      schoolName: user.schoolName,
      organizationName: user.organization?.name,
    });
  } catch (error) {
    console.error("[API] Error getting share code:", error);
    return NextResponse.json({ error: "Failed to get share code" }, { status: 500 });
  }
}

/**
 * POST /api/parent/share-code
 * Regenerates a new share code for the user
 */
export async function POST(request: NextRequest) {
  const session = await getShareCodeSession();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Generate a new unique share code
    const shareCode = await generateUniqueShareCode();

    if (!shareCode) {
      return NextResponse.json({ error: "Failed to generate unique share code" }, { status: 500 });
    }

    // Update the user's share code
    await prisma.user.update({
      where: { id: user.id },
      data: { shareCode },
    });

    // Build the new shareable URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://opletics.com";
    const shareUrl = `${baseUrl}/onboarding/parent-signup?code=${shareCode}`;
    console.log("New shareable url " + shareUrl, "baseUrl ", baseUrl);

    return NextResponse.json({
      shareCode,
      shareUrl,
      message: "Share code regenerated successfully",
    });
  } catch (error) {
    console.error("[API] Error regenerating share code:", error);
    return NextResponse.json({ error: "Failed to regenerate share code" }, { status: 500 });
  }
}
