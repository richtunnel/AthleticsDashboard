import { prisma } from "../lib/database/prisma";
import { jobQueueService } from "../lib/services/job-queue.service";

/**
 * Cleanup script for old completed/failed jobs
 * 
 * Usage: npx ts-node scripts/cleanup-jobs.ts [retention_days]
 * 
 * Default retention: 30 days
 * Cron should run this daily via: /api/cron/cleanup-jobs
 */
async function main() {
  const retentionDays = parseInt(process.argv[2] || "30", 10);
  
  console.log(`[CleanupJobs] Starting job cleanup with ${retentionDays} day retention...`);
  
  const startTime = Date.now();
  
  try {
    // Run cleanup via the service
    const deletedCount = await jobQueueService.cleanup(retentionDays);
    
    const durationMs = Date.now() - startTime;
    console.log(`[CleanupJobs] Deleted ${deletedCount} old jobs in ${durationMs}ms`);
    
  } catch (error) {
    console.error("[CleanupJobs] Cleanup error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[CleanupJobs] Fatal error:", error);
  process.exit(1);
});