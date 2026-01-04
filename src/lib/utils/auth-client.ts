/**
 * Client-safe authentication utilities
 * This file can be imported by both client and server components
 * NO imports from next/headers, next-auth, or authOptions
 */

// Define UserRole enum with only ADMIN and MEMBER
export enum UserRole {
  ADMIN = "ADMIN",
  MEMBER = "MEMBER",
}

export const WRITE_ROLES: UserRole[] = [UserRole.ADMIN];

export const READ_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.MEMBER];

/**
 * Check if a user has permission based on their role
 * @param userRole - The user's role
 * @param allowedRoles - Array of roles that are allowed
 * @returns boolean indicating if the user has permission
 */
export function hasPermission(userRole: UserRole | string | undefined, allowedRoles: UserRole[]): boolean {
  if (!userRole) return false;
  
  // Handle both enum values and string values
  const roleString = typeof userRole === "string" ? userRole : String(userRole);
  return allowedRoles.some((role) => role === roleString);
}