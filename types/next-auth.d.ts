import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

// Define UserRole locally to avoid Prisma dependency
export type UserRole = "SUPER_ADMIN" | "ATHLETIC_DIRECTOR" | "ASSISTANT_AD" | "COACH" | "STAFF" | "VENDOR_READ_ONLY" | "PARENT";

// Define CollaborativeRole locally to avoid Prisma dependency
export type CollaborativeRole = "VIEWER" | "MEMBER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: UserRole;
      organizationId: string;
      organization: {
        id: string;
        name: string;
        timezone: string;
      };
      googleCalendarRefreshToken?: string;
      googleCalendarAccessToken?: string;
      googleCalendarEmail?: string;
      calendarTokenExpiry?: Date;
      city?: string | null;
      // School onboarding fields - centralized to prevent redirect loops
      schoolName?: string | null;
      teamName?: string | null;
      schoolAddress?: string | null;
      lastLoginAt?: Date | null;
      lastLoginDate?: Date | null;
      dailyLoginCount?: number;
      // Collaboration fields
      isCollaborator?: boolean;
      collaboratorRole?: CollaborativeRole;
      ownerUserId?: string;
    } & DefaultSession["user"];
  }

  // Add User interface extension
  interface User extends DefaultUser {
    role: UserRole;
    organizationId?: string;
    organization?: {
      id: string;
      name: string;
      timezone: string;
    };
    googleCalendarRefreshToken?: string;
    googleCalendarAccessToken?: string;
    googleCalendarEmail?: string;
    calendarTokenExpiry?: Date;
    googleCalendarEmail?: string;
    city?: string | null;
    // School onboarding fields - centralized to prevent redirect loops
    schoolName?: string | null;
    teamName?: string | null;
    schoolAddress?: string | null;
    lastLoginAt?: Date | null;
    lastLoginDate?: Date | null;
    dailyLoginCount?: number;
    memberAccessCode?: string;
    memberAccessIssuedAt?: number;
    memberAccessExpiresAt?: number;
    // Collaboration fields
    isCollaborator?: boolean;
    collaboratorRole?: CollaborativeRole;
    ownerUserId?: string;
  }
}

// Add JWT extension
declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role: UserRole;
    organizationId?: string;
    organization?: {
      id: string;
      name: string;
      timezone: string;
    };
    googleCalendarRefreshToken?: string;
    googleCalendarAccessToken?: string;
    calendarTokenExpiry?: Date;
    googleCalendarEmail?: string;
    city?: string | null;
    // School onboarding fields - centralized to prevent redirect loops
    schoolName?: string | null;
    teamName?: string | null;
    schoolAddress?: string | null;
    lastLoginAt?: Date | null;
    lastLoginDate?: Date | null;
    dailyLoginCount?: number;
    memberAccessCode?: string;
    memberAccessIssuedAt?: number;
    memberAccessExpiresAt?: number;
    // Collaboration fields
    isCollaborator?: boolean;
    collaboratorRole?: CollaborativeRole;
    ownerUserId?: string;
  }
}
