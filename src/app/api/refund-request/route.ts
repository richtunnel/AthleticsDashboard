import { NextRequest, NextResponse } from "next/server";
import { getResendClientOptional } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const { name, email, reason } = await req.json();

    if (!name?.trim() || !email?.trim() || !reason?.trim()) {
      return NextResponse.json({ error: "Name, email, and reason are required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    const resend = getResendClientOptional();
    if (resend) {
      await resend.emails.send({
        from: "Opletics <noreply@opletics.com>",
        to: ["support@opletics.com"],
        replyTo: email.trim(),
        subject: `Refund Request from ${name.trim()}`,
        html: `
          <h2>Refund Request</h2>
          <p><strong>Name:</strong> ${name.trim()}</p>
          <p><strong>Email:</strong> ${email.trim()}</p>
          <p><strong>Reason:</strong></p>
          <p>${reason.trim().replace(/\n/g, "<br/>")}</p>
          <hr/>
          <p style="color:#888;font-size:12px;">Submitted via the Refund Policy page on opletics.com</p>
        `,
      });
    } else {
      // Resend not configured — log for manual handling
      console.warn("[RefundRequest] Resend not configured. Refund request from:", email.trim(), "—", reason.trim());
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[RefundRequest] Error:", error);
    return NextResponse.json({ error: "Failed to send refund request." }, { status: 500 });
  }
}
