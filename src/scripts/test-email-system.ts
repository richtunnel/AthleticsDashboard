import { emailQueueService } from "../lib/services/email-queue.service";
import { emailWorkerService } from "../lib/services/email-worker.service";
import { prisma } from "../lib/database/prisma";

async function test() {
  console.log("Starting email system test...");

  // 1. Create a dummy user and organization if they don't exist
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No user found in database to run tests");
    return;
  }

  console.log(`Using user: ${user.email} (${user.id})`);

  // 2. Test enqueuing
  console.log("\n--- Testing Enqueuing ---");
  try {
    const job = await emailQueueService.enqueueBulkEmail({
      userId: user.id,
      organizationId: user.organizationId,
      to: ["test1@example.com", "test2@example.com"],
      subject: "Test Subject",
      body: "<p>Test Body</p>",
    });
    console.log(`Enqueued job: ${job.id}, totalCount: ${job.totalCount}`);
  } catch (error: any) {
    console.error("Enqueuing failed:", error.message);
  }

  // 3. Test processing
  console.log("\n--- Testing Processing ---");
  const processed = await emailWorkerService.processBatch(10);
  console.log(`Processed ${processed} recipients`);

  // 4. Verify results
  console.log("\n--- Verifying Results ---");
  const jobs = await prisma.emailJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1,
    include: { recipients: true }
  });

  if (jobs.length > 0) {
    const job = jobs[0];
    console.log("Latest job status:", job.status);
    console.log("Sent count:", job.sentCount);
    console.log("Failed count:", job.failedCount);
    
    for (const r of job.recipients) {
      console.log(`Recipient ${r.email}: ${r.status} (error: ${r.error})`);
    }
    
    // Check EmailLog
    const logs = await prisma.emailLog.findMany({
      where: {
        sentById: user.id,
        subject: "Test Subject"
      },
      orderBy: { createdAt: 'desc' },
      take: 2
    });
    console.log(`Found ${logs.length} EmailLog entries`);
  } else {
    console.log("No jobs found.");
  }
}

test()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
