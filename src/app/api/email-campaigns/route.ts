import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { NextResponse } from "next/server";
import { checkStorageBeforeWrite } from "@/lib/utils/storage-check";
import { getResendClientOptional } from "@/lib/resend";

export async function GET() {
  const session = await getServerSession(authOptions);
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
  const session = await getServerSession(authOptions);
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
    const group = await prisma.emailGroup.findUnique({
      where: { id: groupId },
      include: { emails: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    if (group.emails.length === 0) {
      return NextResponse.json({ error: "No recipients in group" }, { status: 400 });
    }

    const toEmails = group.emails.map((e) => e.email);

    // Send via Resend
    const resend = getResendClientOptional();
    if (resend) {
      try {
        const emailResponse = await resend.emails.send({
          from: process.env.EMAIL_FROM || "Athletic Director Hub <noreply@yourdomain.com>",
          to: toEmails,
          subject,
          html: body,
        });

        // Log the email
        await prisma.emailLog.create({
          data: {
            to: toEmails,
            cc: [],
            subject,
            body,
            status: emailResponse.error ? "FAILED" : "SENT",
            error: emailResponse.error?.message || null,
            sentAt: emailResponse.error ? null : new Date(),
            sentById: session.user.id,
            campaignId: campaign.id,
            groupId,
          },
        });

        if (emailResponse.error) {
          return NextResponse.json({ 
            error: `Campaign created but failed to send: ${emailResponse.error.message}`,
            campaign,
          }, { status: 500 });
        }
      } catch (error) {
        console.error("Failed to send campaign email:", error);
        return NextResponse.json({ 
          error: "Campaign created but failed to send email",
          campaign,
        }, { status: 500 });
      }
    }
  }

  return NextResponse.json(campaign);
}

// Add PUT for update and DELETE as needed, similar to above.
