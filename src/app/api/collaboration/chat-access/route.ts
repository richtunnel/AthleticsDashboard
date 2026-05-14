import { getAnySession } from "@/lib/utils/collaboratorSession";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";
import { emailGatewayService } from "@/lib/services/email-gateway.service";
import { UserRole } from "@prisma/client";

/**
 * GET /api/collaboration/chat-access
 * Returns the caller's chat access status (for collaborators).
 */
export async function GET() {
  const session = await getAnySession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();
  const collaboration = await prisma.collaborativeMember.findFirst({
    where: { email, status: "ACCEPTED", revokedAt: null },
    select: {
      id: true,
      chatAccess: true,
      chatAccessRequestedAt: true,
      chatAccessReviewedAt: true,
    },
  });

  if (!collaboration) {
    return NextResponse.json({ chatAccess: null, isCollaborator: false });
  }

  return NextResponse.json({
    isCollaborator: true,
    chatAccess: collaboration.chatAccess,
    chatAccessRequestedAt: collaboration.chatAccessRequestedAt?.toISOString() ?? null,
    chatAccessReviewedAt: collaboration.chatAccessReviewedAt?.toISOString() ?? null,
  });
}

/**
 * POST /api/collaboration/chat-access
 * Collaborator requests access to parent chat messages.
 * Notifies the AD via email and creates a dashboard notification.
 */
export async function POST(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email.toLowerCase();

  // Must be a collaborator
  const collaboration = await prisma.collaborativeMember.findFirst({
    where: { email, status: "ACCEPTED", revokedAt: null },
    include: { owner: { select: { id: true, email: true, name: true } } },
  });

  if (!collaboration) {
    return NextResponse.json({ error: "Not a collaborator on this account" }, { status: 403 });
  }

  // Already approved — nothing to do
  if (collaboration.chatAccess === "APPROVED") {
    return NextResponse.json({ message: "Access already approved", chatAccess: "APPROVED" });
  }

  // Mark as PENDING (idempotent — re-requesting resets the timestamp)
  const updated = await prisma.collaborativeMember.update({
    where: { id: collaboration.id },
    data: {
      chatAccess: "PENDING",
      chatAccessRequestedAt: new Date(),
      chatAccessReviewedAt: null,
    },
  });

  // Email the AD
  const adEmail = collaboration.owner.email;
  const adName = collaboration.owner.name || "Athletic Director";
  const collaboratorName = session.user.name || email;
  const settingsUrl = `${process.env.NEXTAUTH_URL || "https://opletics.com"}/dashboard/settings`;

  await emailGatewayService.send({
    to: adEmail,
    subject: `Chat Access Request from ${collaboratorName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Chat Access Request</h2>
        <p>Hi ${adName},</p>
        <p><strong>${collaboratorName}</strong> (${email}) has requested access to view parent messages in your Opletics dashboard.</p>
        <p>You can approve or deny this request from your Settings page:</p>
        <a href="${settingsUrl}" style="display:inline-block;background:#1976d2;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin:12px 0;">
          Review in Settings
        </a>
        <p style="color:#666;font-size:0.875rem;">
          Go to Settings → Collaborator tab to manage chat access for your team members.
        </p>
      </div>
    `,
  });

  return NextResponse.json({ message: "Access requested", chatAccess: "PENDING" });
}

/**
 * PATCH /api/collaboration/chat-access
 * AD approves or revokes a collaborator's chat access.
 * Body: { collaboratorId: string; action: "APPROVE" | "REVOKE" }
 */
export async function PATCH(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only account owners (ADs) can approve/revoke
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, name: true, email: true },
  });

  if (!currentUser || currentUser.role !== UserRole.ATHLETIC_DIRECTOR) {
    return NextResponse.json({ error: "Only the account owner can manage chat access" }, { status: 403 });
  }

  const body = await request.json();
  const { collaboratorId, action } = body as { collaboratorId?: string; action?: string };

  if (!collaboratorId || !["APPROVE", "REVOKE"].includes(action || "")) {
    return NextResponse.json({ error: "collaboratorId and action (APPROVE | REVOKE) are required" }, { status: 400 });
  }

  // Verify the collaborator belongs to this AD
  const collaboration = await prisma.collaborativeMember.findFirst({
    where: { id: collaboratorId, userId: currentUser.id },
    select: { id: true, email: true, chatAccess: true },
  });

  if (!collaboration) {
    return NextResponse.json({ error: "Collaborator not found" }, { status: 404 });
  }

  const newAccess = action === "APPROVE" ? "APPROVED" : "REVOKED";

  await prisma.collaborativeMember.update({
    where: { id: collaboration.id },
    data: {
      chatAccess: newAccess,
      chatAccessReviewedAt: new Date(),
    },
  });

  // Notify the collaborator by email
  const adName = currentUser.name || "Your Athletic Director";
  const dashboardUrl = `${process.env.NEXTAUTH_URL || "https://opletics.com"}/dashboard/messages`;

  if (action === "APPROVE") {
    await emailGatewayService.send({
      to: collaboration.email,
      subject: "Chat Access Approved",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2e7d32;">Chat Access Approved</h2>
          <p>Hi,</p>
          <p><strong>${adName}</strong> has approved your request to view parent messages in Opletics.</p>
          <a href="${dashboardUrl}" style="display:inline-block;background:#2e7d32;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin:12px 0;">
            Open Messages
          </a>
        </div>
      `,
    });
  } else {
    await emailGatewayService.send({
      to: collaboration.email,
      subject: "Chat Access Revoked",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">Chat Access Revoked</h2>
          <p>Hi,</p>
          <p><strong>${adName}</strong> has revoked your access to parent messages in Opletics.</p>
          <p style="color:#666;font-size:0.875rem;">Contact your Athletic Director if you believe this is an error.</p>
        </div>
      `,
    });
  }

  return NextResponse.json({ message: `Access ${newAccess.toLowerCase()}`, chatAccess: newAccess });
}
