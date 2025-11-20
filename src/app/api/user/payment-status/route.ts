import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { checkPaymentStatus } from "@/lib/services/payment-status.service";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const paymentStatus = await checkPaymentStatus(session.user.id);

    return NextResponse.json(paymentStatus, { status: 200 });
  } catch (error: any) {
    console.error("[PaymentStatus] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check payment status" },
      { status: 500 }
    );
  }
}
