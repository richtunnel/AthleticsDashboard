import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/database/prisma";
import { authOptions } from "@/lib/utils/authOptions";

/**
 * GET /api/parent/linked-schools
 * Returns schools linked to the parent user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const links = await prisma.parentAthleteLink.findMany({
      where: {
        parentUserId: user.id,
        active: true,
      },
      select: {
        id: true,
        schoolId: true,
        schoolName: true,
        athleticDirectorId: true,
        athleticDirectorName: true,
        sportName: true,
        sportLevel: true,
      },
    });

    return NextResponse.json({ schools: links });
  } catch (error) {
    console.error("[API] Error fetching linked schools:", error);
    return NextResponse.json(
      { error: "Failed to fetch linked schools" },
      { status: 500 }
    );
  }
}
