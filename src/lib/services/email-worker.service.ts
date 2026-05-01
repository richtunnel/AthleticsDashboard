import { prisma } from "../database/prisma";
import { emailGatewayService } from "./email-gateway.service";
import { EmailRecipientStatus, EmailJobStatus } from "@prisma/client";

export class EmailWorkerService {
  async processBatch(batchSize: number = 50) {
    // 1. Fetch pending or retrying recipients using SKIP LOCKED for atomic locking
    const recipients = await prisma.$queryRaw`
      SELECT * FROM "EmailRecipient"
      WHERE "status" IN ('PENDING', 'RETRYING')
      AND ("lastAttempt" IS NULL OR "lastAttempt" < NOW() - INTERVAL '5 minutes')
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    ` as any[];

    if (recipients.length === 0) {
      return 0;
    }

    console.log(`[EmailWorkerService] Processing batch of ${recipients.length} recipients`);

    for (const recipient of recipients) {
      try {
        const job = await prisma.emailJob.findUnique({
          where: { id: recipient.jobId }
        });

        if (!job) {
          await prisma.emailRecipient.update({
            where: { id: recipient.id },
            data: { status: "FAILED", error: "Job not found" }
          });
          continue;
        }

        // Send email
        const result = await emailGatewayService.send({
          to: recipient.email,
          subject: job.subject,
          body: job.body,
          replyTo: job.replyTo || undefined,
        });

        if (result.success) {
          await prisma.$transaction([
            prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: { 
                status: "SENT", 
                lastAttempt: new Date() 
              }
            }),
            prisma.emailJob.update({
              where: { id: job.id },
              data: { sentCount: { increment: 1 } }
            }),
            prisma.emailLog.create({
              data: {
                to: [recipient.email],
                subject: job.subject,
                body: job.body,
                replyTo: job.replyTo,
                status: "SENT",
                sentAt: new Date(),
                sentById: job.userId,
                gameIds: job.gameIds,
                groupId: job.groupId,
                campaignId: job.campaignId,
                recipientCategory: job.recipientCategory,
                additionalMessage: job.additionalMessage,
                visibleColumnIds: job.visibleColumnIds,
                selectedSchoolNames: job.selectedSchoolNames,
              }
            })
          ]);
        } else {
          const shouldRetry = recipient.retryCount < 3;
          await prisma.$transaction([
            prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: { 
                status: shouldRetry ? "RETRYING" : "FAILED", 
                error: String(result.error),
                retryCount: { increment: 1 },
                lastAttempt: new Date()
              }
            }),
            prisma.emailJob.update({
              where: { id: job.id },
              data: { failedCount: shouldRetry ? undefined : { increment: 1 } } // Only increment job failed count if final failure
            })
          ]);
        }
      } catch (err) {
        console.error(`[EmailWorkerService] Error processing recipient ${recipient.id}:`, err);
      }
    }

    // Check completion for involved jobs
    const jobIds = [...new Set(recipients.map(r => r.jobId))];
    for (const jobId of jobIds) {
      await this.updateJobStatus(jobId);
    }

    return recipients.length;
  }

  private async updateJobStatus(jobId: string) {
    const job = await prisma.emailJob.findUnique({
      where: { id: jobId },
      include: {
        _count: {
          select: {
            recipients: {
              where: {
                status: { in: ["PENDING", "RETRYING"] }
              }
            }
          }
        }
      }
    });

    if (job && job._count.recipients === 0) {
      let finalStatus: EmailJobStatus = "COMPLETED";
      if (job.failedCount > 0) {
        finalStatus = job.sentCount === 0 ? "FAILED" : "PARTIAL_SUCCESS";
      }

      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: finalStatus }
      });
    } else if (job && job.status === "PENDING") {
      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: "PROCESSING" }
      });
    }
  }
}

export const emailWorkerService = new EmailWorkerService();
