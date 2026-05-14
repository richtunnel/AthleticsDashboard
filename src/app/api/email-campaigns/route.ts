import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";
import { getResendClientOptional } from "@/lib/resend";
import { emailQueueService } from "@/lib/services/email-queue.service";

export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const org = await prisma.organization.findFirst({
    where: { users: { some: { id: session.user.id } } },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const groups = await prisma.emailGroup.findMany({
    where: { organizationId: org.id },
  });
  return NextResponse.json(groups);
}

export async function POST(request: Request) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, subject, body, groupId, sendNow } = await request.json();
  if (!subject || !body) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const organization = await prisma.organization.findFirst({
    where: { users: { some: { id: session.user.id } } },
    select: { id: true },
  });

  if (!organization) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const storageCheckResult = await checkStorageBeforeWrite({
    organizationId: organization.id,
    userId: session.user.id,
    data: { name, subject, body, groupId },
  });

  if (storageCheckResult) {
    return storageCheckResult;
  }

  // Create campaign record
  const campaign = await prisma.emailCampaign.create({
    data: { 
      name: name || subject, 
      subject, 
      body, 
      groupId, 
      userId: session.user.id,
      sentAt: sendNow ? new Date() : null,
    },
  });

  // If sendNow is true, send the email immediately
  if (sendNow && groupId) {
    const group = await prisma.emailGroup.findFirst({
      where: { 
        id: groupId,
        organizationId: organization.id
      },
      include: { emails: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.emails.length === 0) {
      return NextResponse.json({ error: "No recipients in group" }, { status: 400 });
    }

    const toEmails = group.emails.map((e) => e.email);

    // Send via Resend using bulk email utility
    const resend = getResendClientOptional();
    if (!resend) {
      console.warn("Resend API key missing — skipping email sending.");
      return NextResponse.json({ 
        error: "Email service not configured. Please set RESEND_API_KEY in environment variables.",
        campaign,
      }, { status: 503 });
    }

    try {
      const job = await emailQueueService.enqueueBulkEmail({
        userId: session.user.id,
        organizationId: organization.id,
        to: toEmails,
        subject,
        body,
        campaignId: campaign.id,
        groupId,
        recipientCategory: "emailGroup",
      });

      return NextResponse.json({ 
        message: "Campaign queued for sending",
        campaign,
        jobId: job.id
      });
    } catch (error) {
      console.error("Failed to queue campaign email:", error);
      return NextResponse.json({ 
        error: "Campaign created but failed to queue for sending",
        campaign,
      }, { status: 500 });
    }
  }

  return NextResponse.json(campaign);
}
