import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { emailAIService } from "@/lib/services/email-ai.service";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { subject, body: emailBody, improvements } = body;

    if (!subject || !emailBody) {
      return NextResponse.json(
        { error: "subject and body are required" },
        { status: 400 }
      );
    }

    const improvedEmail = await emailAIService.improveEmail(
      subject,
      emailBody,
      improvements || []
    );

    return NextResponse.json({
      success: true,
      email: improvedEmail,
    });
  } catch (error) {
    console.error("Email improvement error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to improve email" },
      { status: 500 }
    );
  }
}
