import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { supportService } from "@/lib/services/support.service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized - Please sign in",
        },
        { status: 401 }
      );
    }

    const body = await request.json();
    const rawSubject = typeof body.subject === "string" ? body.subject.trim() : "";
    const rawMessage = typeof body.message === "string" ? body.message.trim() : "";

    if (!rawSubject || !rawMessage) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: subject and message",
        },
        { status: 400 }
      );
    }

    const feedback = await supportService.createFeedbackSubmission({
      userId: session.user.id,
      name: session.user.name || session.user.email || "Unknown User",
      email: session.user.email || undefined,
      subject: rawSubject,
      message: rawMessage,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: feedback.id,
          subject: feedback.subject,
          createdAt: feedback.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating feedback submission:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create feedback submission",
      },
      { status: 500 }
    );
  }
}
