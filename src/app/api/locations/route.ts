import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const uniqueVenues = await prisma.venue.findMany({
      where: {
        organizationId: session.user.organizationId,
      },
      orderBy: {
        name: "asc",
      },
    });

    const locations = uniqueVenues.map((venue) => venue.name).filter((name) => name);

    return NextResponse.json({
      success: true,
      data: locations,
    });
  } catch (error) {
    console.error("Error fetching unique locations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch unique locations",
      },
      { status: 500 }
    );
  }
}
