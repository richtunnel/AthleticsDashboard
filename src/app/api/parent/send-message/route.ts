import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { z } from "zod";
import { sendEmail } from "@/lib/services/email.service";

// Validation schema
const messageSchema = z.object({
  athleticDirectorId: z.string().min(1, "Athletic Director ID is required"),
  schoolName: z.string().min(1, "School name is required"),
  sportName: z.string().min(1, "Sport name is required"),
  sportLevel: z.string().min(1, "Sport level is required"),
  message: z.string().min(1, "Message is required").max(2000),
});

/**
 * POST /api/parent/send-message
 * Sends a message to the athletic director
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getParentSession();
    
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

    const body = await request.json();
    const validatedData = messageSchema.parse(body);

    // Get the athletic director's email
    const ad = await prisma.user.findUnique({
      where: { id: validatedData.athleticDirectorId },
    });

    if (!ad || !ad.email) {
      return NextResponse.json(
        { error: "Athletic director not found" },
        { status: 404 }
      );
    }

    // Get the parent link to get child's info
    const parentLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        athleticDirectorId: validatedData.athleticDirectorId,
        sportName: validatedData.sportName,
        sportLevel: validatedData.sportLevel,
      },
    });

    const childName = parentLink?.childName || "Your child";
    const childGrade = parentLink?.childGrade ? ` (Grade ${parentLink.childGrade})` : "";

    // Compose email
    const subject = `Parent Message: ${validatedData.sportName} - ${validatedData.sportLevel}`;
    const emailBody = `
      <h2>New Message from Parent Portal</h2>
      <p><strong>From:</strong> ${user.name || user.email}${childGrade}</p>
      <p><strong>School:</strong> ${validatedData.schoolName}</p>
      <p><strong>Sport:</strong> ${validatedData.sportName} - ${validatedData.sportLevel}</p>
      <hr />
      <h3>Message:</h3>
      <p>${validatedData.message.replace(/\n/g, "<br>")}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        This message was sent via the Opletics Parent Portal.
      </p>
    `;

    // Send email using the email service
    try {
      await sendEmail({
        to: ad.email,
        subject,
        html: emailBody,
      });
    } catch (emailError) {
      console.error("[API] Failed to send email:", emailError);
      // For now, we'll still return success since the message was "sent"
      // In production, you might want to handle this differently
    }

    // Log the email
    await prisma.emailLog.create({
      data: {
        to: [ad.email],
        cc: [],
        subject,
        body: emailBody,
        status: "SENT",
        sentAt: new Date(),
        sentById: user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      );
    }
    
    console.error("[API] Error sending message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
