import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";

// Define UserRole locally to avoid Prisma dependency
export type UserRole = "SUPER_ADMIN" | "ATHLETIC_DIRECTOR" | "ASSISTANT_AD" | "COACH" | "STAFF" | "VENDOR_READ_ONLY";

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
      googleCalendarEmail?: string;
      city?: string | null;
      lastLoginAt?: Date | null;
      lastLoginDate?: Date | null;
      dailyLoginCount?: number;
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
    lastLoginAt?: Date | null;
    lastLoginDate?: Date | null;
    dailyLoginCount?: number;
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
    lastLoginAt?: Date | null;
    lastLoginDate?: Date | null;
    dailyLoginCount?: number;
  }
}
