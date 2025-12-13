import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * ADMIN ENDPOINT: Check for orphaned Account records
 * These are Account records that don't have a corresponding User
 */
export async function GET(req: NextRequest) {
  try {
    // Find all Account records
    const allAccounts = await prisma.account.findMany({
      select: {
        id: true,
        userId: true,
        provider: true,
        providerAccountId: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Find orphaned accounts (where user is null)
    const orphanedAccounts = allAccounts.filter((account) => !account.user);

    return NextResponse.json({
      success: true,
      totalAccounts: allAccounts.length,
      orphanedCount: orphanedAccounts.length,
      orphanedAccounts: orphanedAccounts.map((account) => ({
        id: account.id,
        userId: account.userId,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
      })),
    });
  } catch (error: any) {
    console.error("Error checking orphaned accounts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check orphaned accounts" },
      { status: 500 }
    );
  }
}

/**
 * POST: Clean up orphaned Account records
 */
export async function POST(req: NextRequest) {
  try {
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true },
    });
    const userIds = new Set(users.map((u) => u.id));

    // Find accounts with non-existent users
    const allAccounts = await prisma.account.findMany({
      select: { id: true, userId: true },
    });

    const orphanedAccountIds = allAccounts
      .filter((account) => !userIds.has(account.userId))
      .map((account) => account.id);

    if (orphanedAccountIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No orphaned accounts found",
        count: 0,
      });
    }

    // Delete orphaned accounts
    const result = await prisma.account.deleteMany({
      where: {
        id: {
          in: orphanedAccountIds,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${result.count} orphaned account records`,
      count: result.count,
    });
  } catch (error: any) {
    console.error("Error cleaning up orphaned accounts:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clean up orphaned accounts" },
      { status: 500 }
    );
  }
}
