import { emailWorkerService } from "../lib/services/email-worker.service";
import { prisma } from "../lib/database/prisma";

async function main() {
  console.log("[EmailWorkerScript] Starting email worker...");
  const startTime = Date.now();
  const maxRuntime = 50000; // 50 seconds to stay within typical serverless/cron limits
  let processedCount = 0;

  try {
    while (Date.now() - startTime < maxRuntime) {
      console.log("[EmailWorkerScript] Checking for pending emails...");
      const count = await emailWorkerService.processBatch(50);
      processedCount += count;
      
      if (count === 0) {
        console.log("[EmailWorkerScript] No more emails to process. Sleeping for 5s...");
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.log(`[EmailWorkerScript] Processed ${count} emails. Continuing...`);
      }
      
      // If we are getting close to the time limit, break
      if (Date.now() - startTime > maxRuntime - 5000) {
        console.log("[EmailWorkerScript] Reached runtime limit, stopping.");
        break;
      }
    }
  } catch (error) {
    console.error("[EmailWorkerScript] Worker error:", error);
  } finally {
    console.log(`[EmailWorkerScript] Worker finished. Total processed: ${processedCount} emails.`);
    await prisma.$disconnect();
  }
}

// Handle errors in main
main().catch((error) => {
  console.error("[EmailWorkerScript] Fatal error:", error);
  process.exit(1);
});
