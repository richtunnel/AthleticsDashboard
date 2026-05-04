import { jobWorker } from "../lib/services/job-worker.service";
import { prisma } from "../lib/database/prisma";

async function main() {
  console.log("[JobWorkerScript] Starting background job worker...");
  
  // Runtime limits for different environments
  const isProduction = process.env.NODE_ENV === "production";
  const maxRuntime = isProduction ? 55000 : 30000; // 55s for serverless, 30s for local
  
  const startTime = Date.now();
  let processedCount = 0;
  let errorCount = 0;

  try {
    // Handle graceful shutdown
    const shutdown = () => {
      console.log("[JobWorkerScript] Shutdown signal received, finishing current work...");
      process.exit(0);
    };
    
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);

    while (Date.now() - startTime < maxRuntime) {
      console.log("[JobWorkerScript] Checking for pending jobs...");
      const result = await jobWorker.run(maxRuntime - (Date.now() - startTime));
      
      processedCount += result.processed;
      errorCount += result.errors;
      
      if (result.processed === 0 && result.errors === 0) {
        console.log("[JobWorkerScript] No jobs found, waiting 3s before next check...");
        await sleep(3000);
        
        // Check if we should continue waiting
        if (Date.now() - startTime >= maxRuntime - 3000) {
          break;
        }
        
        // Check for pending jobs one more time
        const pendingCount = await prisma.backgroundJob.count({
          where: {
            status: "PENDING",
            OR: [
              { nextAttemptAt: null },
              { nextAttemptAt: { lte: new Date() } },
            ],
          },
        });
        
        if (pendingCount === 0) {
          console.log("[JobWorkerScript] Still no pending jobs after wait, exiting...");
          break;
        }
      } else {
        console.log(`[JobWorkerScript] Processed ${result.processed} jobs this iteration`);
        
        // Short pause between iterations to avoid tight loops
        if (result.processed > 0) {
          await sleep(500);
        }
      }
    }
  } catch (error) {
    console.error("[JobWorkerScript] Worker error:", error);
    errorCount++;
  } finally {
    const totalTime = Date.now() - startTime;
    console.log(`[JobWorkerScript] Worker finished. Total processed: ${processedCount}, Errors: ${errorCount}, Runtime: ${totalTime}ms`);
    await prisma.$disconnect();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Handle errors in main
main().catch((error) => {
  console.error("[JobWorkerScript] Fatal error:", error);
  process.exit(1);
});