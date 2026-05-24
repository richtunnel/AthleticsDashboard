import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const schoolName = searchParams.get("school");

    if (!schoolName) {
      return NextResponse.json(
        { error: "School name is required" },
        { status: 400 }
      );
    }

    // Find the organization by name
    const organization = await prisma.organization.findFirst({
      where: {
        name: {
          contains: schoolName,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!organization) {
      return NextResponse.json([]);
    }

    // Find users (coaches, athletic directors, staff) in that organization
    const coaches = await prisma.user.findMany({
      where: {
        organizationId: organization.id,
        role: {
          in: ["ATHLETIC_DIRECTOR", "COACH", "ASSISTANT_AD", "STAFF"],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        schoolEmail: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    // Format the response
    const formattedCoaches = coaches.map((coach) => ({
      id: coach.id,
      name: coach.name || "Unknown",
      email: coach.schoolEmail || coach.email,
      role: coach.role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase()),
      schoolName: organization.name,
    }));

    return NextResponse.json(formattedCoaches);
  } catch (error) {
    console.error("Error fetching coaches:", error);
    return NextResponse.json(
      { error: "Failed to fetch coaches" },
      { status: 500 }
    );
  }
}
