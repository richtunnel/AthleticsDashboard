import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { UserRole, WRITE_ROLES, READ_ROLES, hasPermission } from "@/lib/utils/auth-client";

const DEV_SESSION = {
  user: {
    id: "dev-user-id",
    name: "Dev User",
    email: "dev@example.com",
    role: UserRole.ADMIN,
    organizationId: "dev-org-id",
    organization: {
      id: "dev-org-id",
      name: "Development School",
      timezone: "America/New_York",
    },
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

export async function requireAuth() {
  // BYPASS AUTH IN DEVELOPMENT
  if (process.env.USE_MOCK_DATA === "true") {
    console.log(" DEV MODE: Auth bypassed, using mock session");
    return DEV_SESSION as any;
  }

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new Error("Unauthorized - Please sign in");
  }

  return session;
}

export async function requirePermission(allowedRoles: UserRole[]) {
  const session = await requireAuth();

  if (!hasPermission(session.user.role, allowedRoles)) {
    throw new Error("Forbidden - You do not have permission to perform this action");
  }

  return session;
}

// Export these for backward compatibility
export { hasPermission, WRITE_ROLES, READ_ROLES, UserRole };
