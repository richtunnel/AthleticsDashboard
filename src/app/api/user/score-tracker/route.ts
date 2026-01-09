import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { scoreTrackerEnabled: true },
    });

    return NextResponse.json({ scoreTrackerEnabled: user?.scoreTrackerEnabled ?? false });
  } catch (error) {
    console.error("Error fetching score tracker setting:", error);
    return NextResponse.json({ error: "Failed to fetch setting" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { enabled } = await request.json();

    await prisma.user.update({
      where: { id: session.user.id },
      data: { scoreTrackerEnabled: Boolean(enabled) },
    });

    return NextResponse.json({ scoreTrackerEnabled: Boolean(enabled) });
  } catch (error) {
    console.error("Error updating score tracker setting:", error);
    return NextResponse.json({ error: "Failed to update setting" }, { status: 500 });
  }
}