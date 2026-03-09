import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * Generate a unique share code
 */
function generateShareCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars like 0/O, 1/I
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * GET /api/parent/share-code
 * Gets or creates the share code for the authenticated user
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

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
      // Keep generating until we get a unique code
      let isUnique = false;
      let attempts = 0;
      
      while (!isUnique && attempts < 10) {
        const newCode = generateShareCode();
        const existing = await prisma.user.findUnique({
          where: { shareCode: newCode },
        });
        
        if (!existing) {
          shareCode = newCode;
          isUnique = true;
        }
        attempts++;
      }

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://athleticsdirectorshub.com";
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
  const session = await getServerSession(authOptions);

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
    let shareCode = "";
    let isUnique = false;
    let attempts = 0;
    
    while (!isUnique && attempts < 10) {
      const newCode = generateShareCode();
      const existing = await prisma.user.findUnique({
        where: { shareCode: newCode },
      });
      
      if (!existing) {
        shareCode = newCode;
        isUnique = true;
      }
      attempts++;
    }

    if (!shareCode) {
      return NextResponse.json({ error: "Failed to generate unique share code" }, { status: 500 });
    }

    // Update the user's share code
    await prisma.user.update({
      where: { id: user.id },
      data: { shareCode },
    });

    // Build the new shareable URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://athleticsdirectorshub.com";
    const shareUrl = `${baseUrl}/onboarding/parent-signup?code=${shareCode}`;

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
