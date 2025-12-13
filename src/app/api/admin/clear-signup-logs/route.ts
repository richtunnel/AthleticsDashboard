import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * ADMIN ENDPOINT: Clear all SignupLog entries
 * This is a temporary fix for users who were blocked incorrectly
 */
export async function POST(req: NextRequest) {
  try {
    // Get email from request body
    const body = await req.json();
    const { email } = body;

    if (!email) {
      // Clear ALL signup logs if no email provided
      const result = await prisma.signupLog.deleteMany({});
      return NextResponse.json({
        success: true,
        message: `Cleared ${result.count} signup log entries`,
        count: result.count,
      });
    }

    // Clear signup logs for specific email
    const result = await prisma.signupLog.deleteMany({
      where: {
        email: email.toLowerCase(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${result.count} signup log entries for ${email}`,
      count: result.count,
    });
  } catch (error: any) {
    console.error("Error clearing signup logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to clear signup logs" },
      { status: 500 }
    );
  }
}

/**
 * GET: View all active SignupLog entries
 */
export async function GET(req: NextRequest) {
  try {
    const logs = await prisma.signupLog.findMany({
      where: {
        expiresAt: {
          gt: new Date(),
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      count: logs.length,
      logs: logs.map((log) => ({
        id: log.id,
        email: log.email,
        phone: log.phone,
        reason: log.reason,
        deletedUserId: log.deletedUserId,
        deletedAt: log.deletedAt,
        expiresAt: log.expiresAt,
        daysRemaining: Math.ceil(
          (log.expiresAt.getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24)
        ),
      })),
    });
  } catch (error: any) {
    console.error("Error fetching signup logs:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch signup logs" },
      { status: 500 }
    );
  }
}
