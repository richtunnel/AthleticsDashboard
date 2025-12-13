import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * ADMIN ENDPOINT: Fix signup blocking issue
 * 
 * This clears SignupLog entries that were created before the Dec 11, 2024 fix.
 * The fix ensures ONLY users with failed payments are blocked from re-signing up.
 * 
 * This endpoint clears ALL SignupLog entries that don't have the correct reason.
 */
export async function POST(req: NextRequest) {
  try {
    // Get all SignupLog entries
    const allLogs = await prisma.signupLog.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    console.log(`[FixSignupBlocking] Found ${allLogs.length} active SignupLog entries`);

    // Entries created with the old logic will have reason "account_deleted"
    // Entries created with the new logic have reason "account_deleted_with_failed_payments"
    // We should clear the old ones since they were created incorrectly
    const entriesToClear = allLogs.filter(
      (log) =>
        log.reason === "account_deleted" ||
        log.reason === "account_cleanup_cron" ||
        log.reason === null
    );

    console.log(`[FixSignupBlocking] Clearing ${entriesToClear.length} incorrect entries`);

    if (entriesToClear.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No incorrect SignupLog entries found",
        cleared: 0,
        remaining: allLogs.length,
      });
    }

    // Delete incorrect entries
    const result = await prisma.signupLog.deleteMany({
      where: {
        id: {
          in: entriesToClear.map((log) => log.id),
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.count} incorrect SignupLog entries. Users can now sign up again.`,
      cleared: result.count,
      remaining: allLogs.length - result.count,
      clearedEmails: entriesToClear.map((log) => log.email),
    });
  } catch (error: any) {
    console.error("[FixSignupBlocking] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fix signup blocking" },
      { status: 500 }
    );
  }
}

/**
 * GET: Preview what would be cleared
 */
export async function GET(req: NextRequest) {
  try {
    const allLogs = await prisma.signupLog.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    const entriesToClear = allLogs.filter(
      (log) =>
        log.reason === "account_deleted" ||
        log.reason === "account_cleanup_cron" ||
        log.reason === null
    );

    const correctEntries = allLogs.filter(
      (log) =>
        log.reason === "account_deleted_with_failed_payments" ||
        log.reason === "account_cleanup_cron_with_failed_payments"
    );

    return NextResponse.json({
      success: true,
      totalEntries: allLogs.length,
      incorrectEntries: entriesToClear.length,
      correctEntries: correctEntries.length,
      willClearEmails: entriesToClear.map((log) => ({
        email: log.email,
        reason: log.reason,
        deletedAt: log.deletedAt,
        expiresAt: log.expiresAt,
      })),
      willKeepEmails: correctEntries.map((log) => ({
        email: log.email,
        reason: log.reason,
        deletedAt: log.deletedAt,
        expiresAt: log.expiresAt,
      })),
    });
  } catch (error: any) {
    console.error("[FixSignupBlocking] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check signup blocking" },
      { status: 500 }
    );
  }
}
