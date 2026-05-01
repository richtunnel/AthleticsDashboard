import { prisma } from "../database/prisma";
import { emailGatewayService } from "./email-gateway.service";
import { EmailJobStatus } from "@prisma/client";

export class EmailWorkerService {
  async processBatch(batchSize: number = 50) {
    // 1. Fetch pending or retrying recipients using SKIP LOCKED for atomic locking
    // We use a raw query because Prisma doesn't support SKIP LOCKED yet
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
          // If job is gone, just purge the recipient
          await prisma.emailRecipient.delete({
            where: { id: recipient.id }
          }).catch(() => {});
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
          // SUCCESS: Record in EmailLog and PURGE from Active Queue (EmailRecipient)
          await prisma.$transaction([
            prisma.emailRecipient.delete({
              where: { id: recipient.id }
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
          // FAILURE: Check if we should retry
          const shouldRetry = recipient.retryCount < 3;
          
          if (shouldRetry) {
            // Update for retry
            await prisma.emailRecipient.update({
              where: { id: recipient.id },
              data: { 
                status: "RETRYING", 
                error: String(result.error),
                retryCount: { increment: 1 },
                lastAttempt: new Date()
              }
            });
          } else {
            // FINAL FAILURE: Record in EmailLog and PURGE from Active Queue
            await prisma.$transaction([
              prisma.emailRecipient.delete({
                where: { id: recipient.id }
              }),
              prisma.emailJob.update({
                where: { id: job.id },
                data: { failedCount: { increment: 1 } }
              }),
              prisma.emailLog.create({
                data: {
                  to: [recipient.email],
                  subject: job.subject,
                  body: job.body,
                  replyTo: job.replyTo,
                  status: "FAILED",
                  error: String(result.error),
                  sentAt: null,
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
          }
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
