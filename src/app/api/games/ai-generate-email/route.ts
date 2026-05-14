import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { emailAIService } from "@/lib/services/email-ai.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getAnySession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as any;
    const organizationId = user.organizationId;

    if (!organizationId) {
      return NextResponse.json({ error: "Organization not found" }, { status: 400 });
    }

    const body = await req.json();
    const {
      type,
      gameId,
      gameIds,
      recipientRole,
      tone,
      additionalContext,
      includeDetails,
      generateVariations,
      variationCount,
    } = body;

    if (!type) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    if (!gameId && (!gameIds || gameIds.length === 0)) {
      return NextResponse.json(
        { error: "Either gameId or gameIds is required" },
        { status: 400 }
      );
    }

    if (generateVariations) {
      const variations = await emailAIService.generateMultipleVariations(
        organizationId,
        {
          type,
          gameId,
          gameIds,
          recipientRole,
          tone,
          additionalContext,
          includeDetails,
        },
        variationCount || 3
      );

      return NextResponse.json({
        success: true,
        variations,
      });
    }

    const email = await emailAIService.generateEmail(organizationId, {
      type,
      gameId,
      gameIds,
      recipientRole,
      tone,
      additionalContext,
      includeDetails,
    });

    return NextResponse.json({
      success: true,
      email,
    });
  } catch (error) {
    console.error("AI email generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate email" },
      { status: 500 }
    );
  }
}
