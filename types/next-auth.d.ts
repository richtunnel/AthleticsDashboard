import { DefaultSession } from "next-auth";
import { UserRole } from "@prisma/client";

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
