import { prisma } from "@/lib/database/prisma";
import {
  MEMBER_ACCESS_EMAIL_PREFIX,
  MEMBER_ACCESS_EMAIL_DOMAIN,
  MEMBER_ACCESS_ORG_ID_PREFIX,
  MEMBER_SESSION_MAX_AGE_MS,
} from "@/lib/utils/memberAccess";

/**
 * Delete a member's account and all associated data
 * This is called when a session expires or when a user logs out
 */
export async function deleteMemberSession(userId: string): Promise<void> {
  try {
    await prisma.user.delete({
      where: { id: userId },
    });
    console.log(`[MemberSessionCleanup] Deleted member session user: ${userId}`);
  } catch (error) {
    console.error(`[MemberSessionCleanup] Failed to delete member session user ${userId}:`, error);
  }
}

/**
 * Clean up all expired member sessions
 * This can be called periodically by a cron job or on login
 */
export async function cleanupExpiredMemberSessions(): Promise<number> {
  const cutoffTime = new Date(Date.now() - MEMBER_SESSION_MAX_AGE_MS);

  try {
    // Find all member users whose email matches the pattern and are expired
    // We use a pattern match since each member has a unique email
    const expiredMembers = await prisma.user.findMany({
      where: {
        email: {
          startsWith: MEMBER_ACCESS_EMAIL_PREFIX,
          endsWith: MEMBER_ACCESS_EMAIL_DOMAIN,
        },
        createdAt: {
          lt: cutoffTime,
        },
      },
      select: {
        id: true,
        email: true,
        organizationId: true,
      },
    });

    let deletedCount = 0;

    for (const member of expiredMembers) {
      try {
        // Delete the user and cascade delete all related data
        await prisma.user.delete({
          where: { id: member.id },
        });
        deletedCount++;
        console.log(`[MemberSessionCleanup] Deleted expired member: ${member.email} (${member.id})`);
      } catch (error) {
        console.error(`[MemberSessionCleanup] Failed to delete member ${member.id}:`, error);
      }
    }

    // Also clean up any orphan organizations that were created for members
    // but were not properly deleted due to cascade issues
    const orphanOrgs = await prisma.organization.findMany({
      where: {
        id: {
          startsWith: MEMBER_ACCESS_ORG_ID_PREFIX,
        },
        users: {
          none: {},
        },
        createdAt: {
          lt: cutoffTime,
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    for (const org of orphanOrgs) {
      try {
        await prisma.organization.delete({
          where: { id: org.id },
        });
        console.log(`[MemberSessionCleanup] Deleted orphan organization: ${org.name} (${org.id})`);
      } catch (error) {
        console.error(`[MemberSessionCleanup] Failed to delete orphan org ${org.id}:`, error);
      }
    }

    console.log(`[MemberSessionCleanup] Cleanup complete. Deleted ${deletedCount} expired member sessions and ${orphanOrgs.length} orphan organizations.`);
    return deletedCount;
  } catch (error) {
    console.error("[MemberSessionCleanup] Error during cleanup:", error);
    return 0;
  }
}

/**
 * Check if a member session is expired and delete it if so
 */
export async function checkAndDeleteExpiredSession(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        createdAt: true,
      },
    });

    if (!user) return false;

    // Check if this is a member user
    if (!user.email?.startsWith(MEMBER_ACCESS_EMAIL_PREFIX) || !user.email?.endsWith(MEMBER_ACCESS_EMAIL_DOMAIN)) {
      return false;
    }

    // Check if session is expired
    const expiresAt = user.createdAt.getTime() + MEMBER_SESSION_MAX_AGE_MS;
    if (Date.now() >= expiresAt) {
      await deleteMemberSession(userId);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`[MemberSessionCleanup] Error checking session ${userId}:`, error);
    return false;
  }
}
