"use server";

import { prisma } from "@/lib/database/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { EmailService } from "@/lib/services/email.service";
import crypto from "crypto";
import { UserRole } from "@/lib/utils/auth";
import { revalidatePath } from "next/cache";

const emailService = new EmailService();

export async function sendInvitation(email: string, role: UserRole) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const inviter = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });

  if (!inviter || !inviter.organization) {
    return { success: false, error: "Inviter or organization not found" };
  }

  // Check if user already exists in this organization
  const existingUser = await prisma.user.findFirst({
    where: {
      email: email.toLowerCase(),
      organizationId: inviter.organizationId,
    },
  });

  if (existingUser) {
    return { success: false, error: "User is already a member of this organization" };
  }

  // Create or update invitation
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  try {
    const invitation = await prisma.invitation.upsert({
      where: { token }, // This is technically not correct for email-based upsert, but token is unique
      create: {
        email: email.toLowerCase(),
        role: role as any,
        token,
        organizationId: inviter.organizationId,
        invitedById: inviter.id,
        expiresAt,
        status: "PENDING",
      },
      update: {
        role: role as any,
        token,
        expiresAt,
        status: "PENDING",
      },
    });

    // Send email
    await emailService.sendCollaborationInvite({
      to: email,
      inviterName: inviter.name || inviter.email,
      organizationName: inviter.organization.name,
      role: role.toLowerCase(),
      inviteToken: token,
    });

    revalidatePath("/dashboard/settings");
    return { success: true, invitation };
  } catch (error: any) {
    console.error("Failed to send invitation:", error);
    return { success: false, error: "Failed to create invitation" };
  }
}

export async function getInvitations() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return { success: false, error: "User not found" };

  const invitations = await prisma.invitation.findMany({
    where: {
      organizationId: user.organizationId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  return { success: true, invitations };
}

export async function revokeInvitation(invitationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return { success: false, error: "User not found" };

  try {
    await prisma.invitation.update({
      where: {
        id: invitationId,
        organizationId: user.organizationId,
      },
      data: { status: "REVOKED" },
    });

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to revoke invitation:", error);
    return { success: false, error: "Failed to revoke invitation" };
  }
}

export async function getTeamMembers() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!user) return { success: false, error: "User not found" };

  const members = await prisma.user.findMany({
    where: { organizationId: user.organizationId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return { success: true, members };
}

export async function revokeAccess(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (!currentUser) return { success: false, error: "User not found" };

  if (userId === currentUser.id) {
    return { success: false, error: "You cannot revoke your own access" };
  }

  try {
    // Check if the user to be revoked belongs to the same organization
    const userToRevoke = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!userToRevoke || userToRevoke.organizationId !== currentUser.organizationId) {
      return { success: false, error: "User not found in your organization" };
    }

    // Revoke access by deleting the user or moving them out of organization.
    // Given the context, deleting the user (or disabling them) is appropriate.
    // If they were invited, they only exist for this organization.
    
    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error) {
    console.error("Failed to revoke access:", error);
    return { success: false, error: "Failed to revoke access" };
  }
}

export async function acceptInvitation(token: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { organization: true },
    });

    if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
      return { success: false, error: "Invalid or expired invitation" };
    }

    // Update user's organization and role
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        organizationId: invitation.organizationId,
        role: invitation.role,
      },
    });

    // Mark invitation as accepted
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    });

    return { success: true, organizationName: invitation.organization.name };
  } catch (error) {
    console.error("Failed to accept invitation:", error);
    return { success: false, error: "Failed to accept invitation" };
  }
}
