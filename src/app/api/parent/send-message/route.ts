import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { getParentSession } from "@/lib/utils/parentSession";
import { z } from "zod";
import { ApiResponse } from "@/lib/utils/api-response";
import { handleApiError } from "@/lib/utils/error-handler";
import { logger } from "@/lib/utils/logger";
import { emailLimitService } from "@/lib/services/email-limit.service";

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
 * Sends a message to the athletic director with Transactional Outbox Pattern and Idempotency
 */
export async function POST(request: NextRequest) {
  const context = {
    url: request.url,
    method: request.method,
    userAgent: request.headers.get("user-agent"),
  };

  try {
    const session = await getParentSession();

    if (!session?.user?.email) {
      return ApiResponse.unauthorized();
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return ApiResponse.notFound("User not found");
    }

    const body = await request.json();
    const validatedData = messageSchema.parse(body);

    // 1. Idempotency Check
    const recentMessage = await prisma.chatMessage.findFirst({
      where: {
        senderUserId: user.id,
        content: validatedData.message,
        createdAt: {
          gte: new Date(Date.now() - 60 * 1000), // 60 seconds window
        },
      },
    });

    if (recentMessage) {
      logger.warn("Duplicate message detected", { userId: user.id, ...context });
      return ApiResponse.error("Duplicate message detected. Please wait 60 seconds before sending the same message.", 409);
    }

    // Get the athletic director's info
    const ad = await prisma.user.findUnique({
      where: { id: validatedData.athleticDirectorId },
    });

    if (!ad || !ad.email || !ad.organizationId) {
      return ApiResponse.notFound("Athletic director or organization not found");
    }

    // Get the parent link to get child's info
    const parentLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: user.id,
        schoolId: ad.organizationId,
        sport: validatedData.sportName,
        teamName: validatedData.sportLevel,
      },
    });

    const childName = parentLink?.athleteName || "Your child";
    const childGrade = parentLink?.gradeLevel ? ` (Grade ${parentLink.gradeLevel})` : "";

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

    // 2. Transactional Outbox Pattern
    // Wrap message saving and email enqueuing in a single transaction
    try {
      await prisma.$transaction(async (tx) => {
        // Find or create conversation
        let conversation = await tx.conversation.findUnique({
          where: {
            parentUserId_schoolId: {
              parentUserId: user.id,
              schoolId: ad.organizationId,
            },
          },
        });

        if (!conversation) {
          conversation = await tx.conversation.create({
            data: {
              parentUserId: user.id,
              schoolId: ad.organizationId,
            },
          });
        }

        // Save Chat Message
        await tx.chatMessage.create({
          data: {
            conversationId: conversation.id,
            senderUserId: user.id,
            content: validatedData.message,
          },
        });

        // Enqueue Email (Outbox)
        // Check limits first (within transaction is safer but might be slow, 
        // however for single message it's fine)
        const limitCheck = await emailLimitService.checkEmailLimits(user.id, 1);
        if (!limitCheck.allowed) {
          throw new Error(`Email limit exceeded: ${limitCheck.reason}`);
        }

        const job = await tx.emailJob.create({
          data: {
            userId: user.id,
            organizationId: ad.organizationId,
            subject,
            body: emailBody,
            status: "PENDING",
            totalCount: 1,
          },
        });

        await tx.emailRecipient.create({
          data: {
            jobId: job.id,
            email: ad.email!,
            status: "PENDING",
          },
        });

        logger.info("Message saved and email enqueued", { userId: user.id, jobId: job.id });
      });

      return ApiResponse.success({ message: "Message sent successfully" });
    } catch (dbError: any) {
      // 3. Graceful Degradation
      // If DB is unavailable or transaction fails due to connection issues
      if (dbError.code === 'P2024' || dbError.message.includes('connection')) {
        logger.error("Email queue unavailable", { error: dbError, ...context });
        return new NextResponse(
          JSON.stringify({ 
            success: false, 
            error: "Service temporarily unavailable. Please try again in a few moments.",
            retryAfter: 60 
          }),
          {
            status: 503,
            headers: {
              "Retry-After": "60",
              "Content-Type": "application/json",
            },
          }
        );
      }
      throw dbError; // Let the outer catch handle it
    }
  } catch (error) {
    logger.error("Error in send-message API", { error, ...context });
    return handleApiError(error);
  }
}
