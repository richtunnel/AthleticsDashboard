/**
 * BullMQ worker process entrypoint.
 *
 * Run as a separate long-lived container (see docker-compose.yml `worker`
 * service). Importing the workers registry boots every queue worker.
 *
 * Local:        npm run worker
 * Production:   automatically started by docker-compose
 */

import { workers, shutdownWorkers } from "../lib/queue/workers";
import { prisma } from "../lib/database/prisma";

async function main() {
  console.log(`[queue-worker] starting ${workers.length} workers`);
  workers.forEach((w) => {
    console.log(`  • ${w.name}  (concurrency: ${w.opts.concurrency ?? 1})`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[queue-worker] received ${signal}`);
    await shutdownWorkers();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Surface unhandled errors instead of silently crashing
  process.on("unhandledRejection", (reason) => {
    console.error("[queue-worker] unhandled rejection:", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[queue-worker] uncaught exception:", err);
  });

  // Keep the process alive — workers run forever
}

main().catch((err) => {
  console.error("[queue-worker] fatal:", err);
  process.exit(1);
});
