import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export const WRITE_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ATHLETIC_DIRECTOR, UserRole.ASSISTANT_AD];

export const READ_ROLES: UserRole[] = [...WRITE_ROLES, UserRole.COACH, UserRole.STAFF, UserRole.VENDOR_READ_ONLY];

export async function requireAuth() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized - Please sign in");
  }

  return session;
}

export function hasPermission(userRole: UserRole | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

export async function requirePermission(allowedRoles: UserRole[]) {
  const session = await requireAuth();

  if (!hasPermission(session.user.role, allowedRoles)) {
    throw new Error("Forbidden - You do not have permission to perform this action");
  }

  return session;
}
