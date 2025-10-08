import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";

// Define UserRole enum locally to match Prisma schema
// This ensures the code works even before Prisma client is generated
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ATHLETIC_DIRECTOR = "ATHLETIC_DIRECTOR",
  ASSISTANT_AD = "ASSISTANT_AD",
  COACH = "COACH",
  STAFF = "STAFF",
  VENDOR_READ_ONLY = "VENDOR_READ_ONLY",
}

export const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ATHLETIC_DIRECTOR, UserRole.ASSISTANT_AD];

export const READ_ROLES: UserRole[] = [...WRITE_ROLES, UserRole.COACH, UserRole.STAFF, UserRole.VENDOR_READ_ONLY];

export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized - Please sign in");
  }

  return session;
}

export function hasPermission(userRole: UserRole | string | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  // Handle both enum values and string values
  const roleString = typeof userRole === "string" ? userRole : userRole;
  return allowedRoles.some((role) => role === roleString || role.toString() === roleString);
}

export async function requirePermission(allowedRoles: UserRole[]) {
  const session = await requireAuth();

  if (!hasPermission(session.user.role, allowedRoles)) {
    throw new Error("Forbidden - You do not have permission to perform this action");
  }

  return session;
}
