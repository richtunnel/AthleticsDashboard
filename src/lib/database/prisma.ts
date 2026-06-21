// NOTE: do NOT add `import "server-only"` here. This module is shared by the
// Next.js app AND the standalone BullMQ worker (src/scripts/queue-worker.ts,
// run via tsx with no Next bundler). `server-only` only resolves inside Next's
// build, so importing it crash-loops the worker with MODULE_NOT_FOUND.

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
