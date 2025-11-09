import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { aiSchedulerService } from "@/lib/services/aiScheduler.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { suggestion, recipientInfo } = body;

    if (!suggestion || !recipientInfo) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: suggestion, recipientInfo",
        },
        { status: 400 }
      );
    }

    const email = await aiSchedulerService.generateSchedulingEmail(
      session.user.organizationId,
      suggestion,
      recipientInfo
    );

    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error) {
    console.error("Failed to generate email:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate email",
      },
      { status: 500 }
    );
  }
}
