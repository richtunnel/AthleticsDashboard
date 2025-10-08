import { DefaultSession } from "next-auth";

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
    } & DefaultSession["user"];
  }
}
