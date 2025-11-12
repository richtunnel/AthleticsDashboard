import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { schedulerAIService } from "@/lib/services/scheduler-ai.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const body = await req.json();
    const { proposedDate, proposedTime, teamId, venueId } = body;

    if (!proposedDate || !teamId) {
      return NextResponse.json(
        { error: "proposedDate and teamId are required" },
        { status: 400 }
      );
    }

    const result = await schedulerAIService.detectConflicts(
      organizationId,
      new Date(proposedDate),
      proposedTime,
      teamId,
      venueId
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Conflict detection error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to detect conflicts" },
      { status: 500 }
    );
  }
}
