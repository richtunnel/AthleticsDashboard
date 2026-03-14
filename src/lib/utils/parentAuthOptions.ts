import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database/prisma";
import { encode as defaultJwtEncode, decode as defaultJwtDecode } from "next-auth/jwt";
import { isSignupBlocked } from "@/lib/services/signup-log.service";
import { generateUniqueShareCode } from "@/lib/utils/shareCode";
import { runNonCritical } from "@/lib/utils/nonCritical";
import { emailService } from "@/lib/services/email.service";
import { trackServerEvent, identifyServerUser } from "@/lib/analytics/mixpanel.server";

/**
 * Separate NextAuth configuration for parent authentication.
 *
 * This creates an independent session with its own cookie (`parent-session-token`)
 * so that a parent and an Athletic Director can be logged in simultaneously
 * in the same browser without overwriting each other's session.
 */

// Wrap the PrismaAdapter to customize createUser for parents
const adapter = PrismaAdapter(prisma);
const parentAdapter = {
  ...adapter,
  async createUser(user: any) {
    // Check if email is blocked due to recent account deletion (90-day rule)
    const signupCheck = await isSignupBlocked(user.email);
    if (signupCheck.blocked) {
      console.error("[ParentOAuth] Signup blocked for email:", user.email, "Expires:", signupCheck.expiresAt);
      throw new Error(
        "This email was used for an account that was recently deleted. Please wait before signing up again or contact support.",
      );
    }

    // Generate a unique share code for the new user
    const shareCode = await generateUniqueShareCode();

    // Parents always get role=PARENT and a family organization
    const newUser = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        role: "PARENT",
        plan: "parent_free",
        shareCode,
        organization: {
          create: {
            name: user.name ? `${user.name}'s Family` : "My Family",
            timezone: "America/New_York",
          },
        },
      },
      include: {
        organization: true,
      },
    });

    // Send welcome email (non-blocking)
    if (newUser.email) {
      void runNonCritical(
        () =>
          emailService.sendWelcomeEmail({
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
          }),
        `welcome email for parent user ${newUser.id}`,
      );
    }

    // Track signup in Mixpanel (non-blocking)
    void runNonCritical(() => {
      trackServerEvent("User Signup", {
        distinct_id: newUser.id,
        signup_method: "google",
        plan: newUser.plan,
        email: newUser.email,
        name: newUser.name,
        role: "PARENT",
      });
      identifyServerUser(newUser.id, {
        $email: newUser.email,
        $name: newUser.name,
        plan: newUser.plan,
        role: "PARENT",
        signup_method: "google",
        signup_date: new Date().toISOString(),
      });
    }, `mixpanel tracking for parent user ${newUser.id}`);

    return newUser;
  },

  // Override linkAccount to remove unsupported fields
  async linkAccount(account: any) {
    const { refresh_token_expires_in, ...accountData } = account;
    return adapter.linkAccount!(accountData);
  },
} as any;

export const parentAuthOptions: NextAuthOptions = {
  adapter: parentAdapter,

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          // Parents only need basic profile scopes — no calendar access
          scope: ["openid", "email", "profile"].join(" "),
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        if (account?.provider === "google") {
          const email = profile?.email ?? user?.email ?? undefined;

          if (email) {
            try {
              const existingUser = await prisma.user.findUnique({
                where: { email },
                select: { id: true },
              });

              // If user exists, allow sign-in (no token update needed for parents)
              // If user doesn't exist, allow NextAuth + adapter to create them
            } catch (err) {
              console.error("[ParentAuth] Failed to check user during sign-in", { email, error: err });
            }
          }
        }

        return true;
      } catch (error) {
        console.error("[ParentAuth] SignIn callback error:", error);
        return true;
      }
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role;
        session.user.organizationId = token.organizationId || "";
        session.user.organization = token.organization || {
          id: "",
          name: "",
          timezone: "America/New_York",
        };
      }
      return session;
    },

    async jwt({ token, user, account, trigger }) {
      // On initial sign-in, populate token from user object
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organization = user.organization;
      }

      // On Google OAuth sign-in, read fresh data from DB
      if (account?.provider === "google" && token.email) {
        const dbUser = (await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            role: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
                timezone: true,
              },
            },
          },
        } as any)) as any;

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
        }
      }

      // On session update trigger or missing data, refresh from DB
      if ((trigger === "update" || !token.organization) && token.email) {
        const dbUser = (await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            role: true,
            organizationId: true,
            organization: {
              select: {
                id: true,
                name: true,
                timezone: true,
              },
            },
          },
        } as any)) as any;

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
        }
      }

      return token;
    },

    async redirect({ url, baseUrl }) {
      try {
        const resolvedUrl = url.startsWith("/") ? new URL(url, baseUrl) : new URL(url);
        const baseOrigin = new URL(baseUrl);

        if (resolvedUrl.origin !== baseOrigin.origin) {
          return baseUrl;
        }

        if (resolvedUrl.searchParams.has("postLogout")) {
          return `${baseUrl}/onboarding/parent-signup`;
        }

        // Check if this is a new user signup
        const isNewUser = resolvedUrl.searchParams.has("newUser");

        // New parent users go to parent onboarding
        if (isNewUser) {
          return `${baseUrl}/onboarding/parent`;
        }

        // Parent callback
        if (resolvedUrl.pathname.startsWith("/onboarding/parent")) {
          return resolvedUrl.toString();
        }

        // Default: go to parent dashboard
        if (resolvedUrl.pathname === "/" || resolvedUrl.pathname.startsWith("/dashboard")) {
          return `${baseUrl}/parent-dashboard`;
        }

        // Parent dashboard routes
        if (resolvedUrl.pathname.startsWith("/parent-dashboard")) {
          return resolvedUrl.toString();
        }

        return resolvedUrl.toString();
      } catch {
        return `${baseUrl}/parent-dashboard`;
      }
    },
  },

  jwt: {
    async encode(params) {
      return defaultJwtEncode(params as any);
    },
    async decode(params) {
      return defaultJwtDecode(params as any);
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-parent-session-token" : "parent-session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/onboarding/parent-signup",
    signOut: "/onboarding/parent-signup",
    error: "/onboarding/parent-signup",
  },

  debug: process.env.NODE_ENV === "development",
};
