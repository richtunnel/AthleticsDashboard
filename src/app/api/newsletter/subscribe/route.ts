import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { slackService } from "@/lib/services/slack.service";
import { sendCapiEvent } from "@/lib/analytics/meta-capi";
import { extractRequestMetadataFromHeaders } from "@/lib/utils/requestMetadata";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    // Validate email format
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    // Normalize email to lowercase
    const normalizedEmail = email.toLowerCase().trim();
    const sanitizedName = name ? name.trim() : "";

    // Check if email already exists
    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingSubscriber) {
      return NextResponse.json(
        { message: "You're already subscribed to our newsletter!" },
        { status: 200 }
      );
    }

    // Create new subscriber
    await prisma.newsletterSubscriber.create({
      data: {
        email: normalizedEmail,
      },
    });

    // Meta CAPI — Subscribe + Lead (fire-and-forget, non-blocking)
    const { ip, userAgent } = extractRequestMetadataFromHeaders(request.headers);
    const capiUserData = { email: normalizedEmail, ip, userAgent };
    void sendCapiEvent({
      eventName: "Subscribe",
      eventId: `newsletter_sub_${normalizedEmail}`,
      sourceUrl: request.headers.get("referer") ?? undefined,
      userData: capiUserData,
    });
    void sendCapiEvent({
      eventName: "Lead",
      eventId: `newsletter_lead_${normalizedEmail}`,
      sourceUrl: request.headers.get("referer") ?? undefined,
      userData: capiUserData,
      customData: { content_name: "Newsletter" },
    });

    // Send Slack notification (non-blocking)
    slackService.sendEmailSubscriptionNotification({
      time: new Date().toISOString(),
      endpoint: '/api/newsletter/subscribe',
      customer: sanitizedName ? `${sanitizedName} (${normalizedEmail})` : normalizedEmail,
      body: `New newsletter subscription from ${normalizedEmail}`,
    }).catch(err => console.error('Failed to send Slack notification:', err));

    return NextResponse.json(
      { message: "Successfully subscribed to our newsletter!" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return NextResponse.json(
      { error: "Subscription unsuccessful. Please try again later." },
      { status: 500 }
    );
  }
}
