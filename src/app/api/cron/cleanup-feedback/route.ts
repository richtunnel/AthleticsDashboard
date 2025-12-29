import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not configured");
      return NextResponse.json(
        { error: "Cron secret not configured" },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const deletedFeedback = await prisma.feedbackSubmission.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
      },
    });

    const deletedTickets = await prisma.supportTicket.deleteMany({
      where: {
        createdAt: {
          lt: ninetyDaysAgo,
        },
        status: {
          in: ["CLOSED"],
        },
      },
    });

    console.log(
      `Cleanup completed: ${deletedFeedback.count} feedback entries and ${deletedTickets.count} support tickets deleted`
    );

    return NextResponse.json({
      success: true,
      deletedFeedback: deletedFeedback.count,
      deletedTickets: deletedTickets.count,
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return NextResponse.json(
      { error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
