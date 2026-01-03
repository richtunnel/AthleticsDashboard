// Client-safe authentication utilities
// This file can be imported by both server and client components
// It does NOT import from "next/headers" or "next-auth" directly

export enum UserRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export const WRITE_ROLES: UserRole[] = [UserRole.ADMIN];

export const READ_ROLES: UserRole[] = [...WRITE_ROLES, UserRole.MEMBER];

export function hasPermission(userRole: UserRole | string | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  const roleString = typeof userRole === "string" ? userRole : userRole;
  return allowedRoles.some((role) => role === roleString || role.toString() === roleString);
}
