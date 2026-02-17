import { CollaborativeRole } from "@prisma/client";

/**
 * Get the maximum number of collaborators allowed for a given plan type
 */
export function getCollaboratorLimit(planType: string | null | undefined): number {
  // Handle null, undefined, or various plan type formats
  const plan = (planType || "").toLowerCase();
  
  // Free plans and trial
  if (plan.includes("free") || plan.includes("trial") || !plan) {
    return 1;
  }
  
  // Standard plans
  if (plan.includes("standard") || plan.includes("monthly") || plan.includes("basic")) {
    return 3;
  }
  
  // Team and enterprise plans
  if (plan.includes("team") || plan.includes("business") || plan.includes("annual") || plan.includes("plus")) {
    return 6;
  }
  
  // Default fallback
  return 1;
}

/**
 * Check if a role has access to a specific feature
 */
export function hasCollaborativeAccess(
  role: CollaborativeRole | null | undefined,
  requiredRole: "VIEWER" | "MEMBER",
  context: "VIEW" | "EDIT" | "ADMIN"
): boolean {
  if (!role) return false;
  
  // Admin access (account owner) - can do everything
  if (context === "ADMIN") return false; // Only account owners can access admin features
  
  // VIEWER role permissions
  if (role === "VIEWER") {
    return context === "VIEW"; // Viewers can only view, not edit
  }
  
  // MEMBER role permissions
  if (role === "MEMBER") {
    return context === "VIEW" || context === "EDIT"; // Members can view and edit
  }
  
  return false;
}

/**
 * Generate a JWT token for invitation acceptance
 */
export function generateInvitationToken(payload: {
  email: string;
  ownerId: string;
  role: CollaborativeRole;
  invitedAt: Date;
  expiresAt: Date;
}): string {
  const jwt = require("jsonwebtoken");
  return jwt.sign(payload, process.env.JWT_SECRET || "default-secret", {
    expiresIn: "24h",
  });
}

/**
 * Verify and decode an invitation token
 */
export function verifyInvitationToken(token: string): {
  email: string;
  ownerId: string;
  role: CollaborativeRole;
  invitedAt: Date;
  expiresAt: Date;
} | null {
  try {
    const jwt = require("jsonwebtoken");
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default-secret");
    return decoded;
  } catch (error) {
    console.error("Invalid invitation token:", error);
    return null;
  }
}

/**
 * Check if an invitation has expired (24 hours)
 */
export function isInvitationExpired(invitedAt: Date, expiresAt?: Date): boolean {
  const now = new Date();
  const expiryTime = expiresAt || new Date(invitedAt.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  return now > expiryTime;
}

/**
 * Format collaborator count display
 */
export function formatCollaboratorCount(used: number, limit: number): {
  text: string;
  percentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
} {
  const percentage = (used / limit) * 100;
  const isNearLimit = used >= limit * 0.8; // 80% or more
  const isAtLimit = used >= limit;
  
  return {
    text: `${used} of ${limit} slots used`,
    percentage: Math.min(percentage, 100),
    isNearLimit,
    isAtLimit,
  };
}