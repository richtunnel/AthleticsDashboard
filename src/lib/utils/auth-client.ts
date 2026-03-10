/**
 * Client-safe authentication utilities
 * This file can be imported by both client and server components
 * NO imports from next/headers, next-auth, or authOptions
 */

// Define UserRole enum with all roles
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ATHLETIC_DIRECTOR = "ATHLETIC_DIRECTOR",
  ASSISTANT_AD = "ASSISTANT_AD",
  COACH = "COACH",
  STAFF = "STAFF",
  VENDOR_READ_ONLY = "VENDOR_READ_ONLY",
  PARENT = "PARENT",
}

export const WRITE_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ATHLETIC_DIRECTOR,
  UserRole.ASSISTANT_AD,
  UserRole.COACH,
  UserRole.STAFF,
];

export const READ_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ATHLETIC_DIRECTOR,
  UserRole.ASSISTANT_AD,
  UserRole.COACH,
  UserRole.STAFF,
  UserRole.VENDOR_READ_ONLY,
];

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