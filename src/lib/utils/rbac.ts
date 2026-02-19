import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { prisma } from "@/lib/database/prisma";
import { CollaborativeRole } from "@prisma/client";

/**
 * Check if the current user has access to perform an action
 * based on their role (either as account owner or collaborator)
 */
export async function checkCollaborativeAccess(
  requiredRole: "VIEWER" | "MEMBER",
  context: "VIEW" | "EDIT" | "ADMIN"
): Promise<{
  hasAccess: boolean;
  isOwner: boolean;
  role?: CollaborativeRole;
  error?: string;
}> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return {
      hasAccess: false,
      isOwner: false,
      error: "Authentication required",
    };
  }

  const userId = session.user.id;
  const userEmail = session.user.email?.toLowerCase();

  if (!userEmail) {
    return {
      hasAccess: false,
      isOwner: false,
      error: "User email not found",
    };
  }

  // Check if the user is the account owner
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (!user) {
    return {
      hasAccess: false,
      isOwner: false,
      error: "User not found",
    };
  }

  // Check if user is a collaborator on their current organization
  const collaboration = await prisma.collaborativeMember.findFirst({
    where: {
      email: userEmail,
      status: "ACCEPTED",
      revokedAt: null,
    },
    select: {
      role: true,
    },
  });

  // If not a collaborator, they're the owner (or neither)
  if (!collaboration) {
    // If they're the owner (checking their own organization)
    // For now, we assume if there's no collaboration record, they're the owner
    // The actual ownership check would be done via session context
    return {
      hasAccess: context === "ADMIN" ? true : context !== "ADMIN",
      isOwner: true,
    };
  }

  // User is a collaborator - check their role
  const collaboratorRole = collaboration.role;

  // VIEWER role can only VIEW
  if (collaboratorRole === "VIEWER") {
    if (context === "VIEW") {
      return {
        hasAccess: true,
        isOwner: false,
        role: collaboratorRole,
      };
    }
    return {
      hasAccess: false,
      isOwner: false,
      role: collaboratorRole,
      error: "Viewers cannot perform this action",
    };
  }

  // MEMBER role can VIEW and EDIT, but not ADMIN
  if (collaboratorRole === "MEMBER") {
    if (context === "ADMIN") {
      return {
        hasAccess: false,
        isOwner: false,
        role: collaboratorRole,
        error: "Only account administrators can access settings",
      };
    }
    return {
      hasAccess: true,
      isOwner: false,
      role: collaboratorRole,
    };
  }

  return {
    hasAccess: false,
    isOwner: false,
    error: "Invalid role",
  };
}

/**
 * Check if the current user is an account owner (not a collaborator)
 */
export async function isAccountOwner(): Promise<boolean> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return false;
  }

  const userId = session.user.id;
  const userEmail = session.user.email?.toLowerCase();

  if (!userEmail) {
    return false;
  }

  // Check if the user has any accepted collaboration on their own organization
  // If they do, they're a collaborator, not an owner (in that context)
  const collaboration = await prisma.collaborativeMember.findFirst({
    where: {
      email: userEmail,
      status: "ACCEPTED",
      revokedAt: null,
    },
    select: {
      id: true,
    },
  });

  // If there's no collaboration record, they're likely the owner
  // However, this needs to be combined with the current context (organization)
  return !collaboration;
}

/**
 * Check if the current user can access settings
 * Settings should only be accessible to account owners
 */
export async function canAccessSettings(): Promise<{
  canAccess: boolean;
  reason?: string;
}> {
  const access = await checkCollaborativeAccess("VIEWER", "ADMIN");
  
  if (access.isOwner) {
    return { canAccess: true };
  }

  return {
    canAccess: false,
    reason: access.error || "Only account administrators can access settings",
  };
}

/**
 * Get the current user's collaboration role for an organization
 */
export async function getCollaborationRole(): Promise<{
  isCollaborator: boolean;
  role?: CollaborativeRole;
  ownerId?: string;
}> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return { isCollaborator: false };
  }

  const userId = session.user.id;
  const userEmail = session.user.email?.toLowerCase();

  if (!userEmail) {
    return { isCollaborator: false };
  }

  const collaboration = await prisma.collaborativeMember.findFirst({
    where: {
      email: userEmail,
      status: "ACCEPTED",
      revokedAt: null,
    },
    select: {
      role: true,
      userId: true,
    },
  });

  if (!collaboration) {
    return { isCollaborator: false };
  }

  return {
    isCollaborator: true,
    role: collaboration.role,
    ownerId: collaboration.userId,
  };
}