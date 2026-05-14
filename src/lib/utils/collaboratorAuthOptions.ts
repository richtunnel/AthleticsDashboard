import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database/prisma";
import { encode as defaultJwtEncode, decode as defaultJwtDecode } from "next-auth/jwt";
import { generateUniqueShareCode } from "@/lib/utils/shareCode";
import { runNonCritical } from "@/lib/utils/nonCritical";
import { isSignupBlocked } from "@/lib/services/signup-log.service";
import {
  INVITATION_COOKIE_NAME,
  checkInvitationCookie,
  clearInvitationCookie,
  setBypassOnboardingCookie,
} from "@/lib/utils/invitation";

/**
 * Separate NextAuth configuration for collaborator authentication.
 *
 * Uses its own cookie (`collaborator-session-token`) so that a collaborator
 * and an Athletic Director can be simultaneously logged in on the same browser
 * without overwriting each other's session.
 *
 * DEPLOYMENT NOTE: The callback URL `/api/auth/collaborator/callback/google`
 * must be registered as an authorised redirect URI in Google Cloud Console.
 * Development: http://localhost:3000/api/auth/collaborator/callback/google
 * Production:  https://opletics.com/api/auth/collaborator/callback/google
 */

const adapter = PrismaAdapter(prisma);

const collaboratorAdapter = {
  ...adapter,

  async createUser(user: any) {
    // Check deletion block
    const signupCheck = await isSignupBlocked(user.email);
    if (signupCheck.blocked) {
      console.error("[CollaboratorAuth] Signup blocked:", user.email);
      throw new Error(
        "This email was used for an account that was recently deleted. Please wait before signing up again.",
      );
    }

    const shareCode = await generateUniqueShareCode();
    const invitationData = await checkInvitationCookie();

    let newUser: any;
    if (invitationData) {
      console.log(`[CollaboratorAuth] Creating user ${user.email} via invitation in org ${invitationData.organizationId}`);
      newUser = await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified,
          role: invitationData.role,
          plan: "free_trial_plan",
          shareCode,
          organizationId: invitationData.organizationId,
          schoolName: invitationData.schoolName,
          teamName: invitationData.teamName,
          schoolAddress: invitationData.schoolAddress,
          city: invitationData.city,
          aiSchedulerEnabled: invitationData.aiSchedulerEnabled,
          aiTravelTimesEnabled: invitationData.aiTravelTimesEnabled,
          aiEmailGenerationEnabled: invitationData.aiEmailGenerationEnabled,
          costBudgetEnabled: invitationData.costBudgetEnabled,
          scoreTrackerEnabled: invitationData.scoreTrackerEnabled,
        },
        include: { organization: true },
      });
      await clearInvitationCookie();
      await setBypassOnboardingCookie();
    } else {
      newUser = await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified,
          role: "VENDOR_READ_ONLY",
          plan: "free_trial_plan",
          shareCode,
          organization: {
            create: {
              name: user.name ? `${user.name}'s Organization` : "My Organization",
              timezone: "America/New_York",
            },
          },
        },
        include: { organization: true },
      });
    }

    return newUser;
  },

  async linkAccount(account: any) {
    const { refresh_token_expires_in, ...accountData } = account;
    const { provider, providerAccountId, userId, ...rest } = accountData;
    return prisma.account.upsert({
      where: { provider_providerAccountId: { provider, providerAccountId } },
      create: accountData,
      update: { userId, ...rest },
    });
  },
} as any;

const collaboratorCallbackUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/auth/collaborator/callback/google`;

export const collaboratorAuthOptions: NextAuthOptions = {
  adapter: collaboratorAdapter,

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
          scope: ["openid", "email", "profile"].join(" "),
          redirect_uri: collaboratorCallbackUrl,
        },
      },
      token: {
        async request({ client, params, checks }: any) {
          const tokens = await client.callback(collaboratorCallbackUrl, params, checks);
          return { tokens };
        },
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      return true;
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
      if (
        token.email &&
        (trigger === "update" || user || !token.organization || !token.role)
      ) {
        const dbUser = (await prisma.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            role: true,
            organizationId: true,
            organization: {
              select: { id: true, name: true, timezone: true },
            },
            schoolName: true,
            teamName: true,
            schoolAddress: true,
          },
        } as any)) as any;

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
          token.schoolName = dbUser.schoolName ?? undefined;
          token.teamName = dbUser.teamName ?? undefined;
          token.schoolAddress = dbUser.schoolAddress ?? undefined;
        }
      } else if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organization = user.organization;
      }

      // Collaborators (non-ATHLETIC_DIRECTOR roles) are always considered onboarded
      const requiresSchoolDetails = token.role === "ATHLETIC_DIRECTOR";
      token.isOnboarded = !requiresSchoolDetails || Boolean(
        token.schoolName?.trim() && token.teamName?.trim() && token.schoolAddress?.trim()
      );

      return token;
    },

    async redirect({ url, baseUrl }) {
      try {
        const resolvedUrl = url.startsWith("/") ? new URL(url, baseUrl) : new URL(url);
        if (new URL(resolvedUrl.href).origin !== new URL(baseUrl).origin) return baseUrl;

        if (resolvedUrl.pathname.startsWith("/accept-invitation")) {
          return resolvedUrl.toString();
        }
        if (resolvedUrl.pathname.startsWith("/dashboard")) {
          return resolvedUrl.toString();
        }
        return `${baseUrl}/dashboard`;
      } catch {
        return `${baseUrl}/dashboard`;
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
    maxAge: 30 * 24 * 60 * 60,
  },

  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-collaborator-session-token"
          : "collaborator-session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
    csrfToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Host-collaborator-next-auth.csrf-token"
          : "collaborator-next-auth.csrf-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
    callbackUrl: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-collaborator-next-auth.callback-url"
          : "collaborator-next-auth.callback-url",
      options: { sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
    state: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-collaborator-next-auth.state"
          : "collaborator-next-auth.state",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 900 },
    },
    pkceCodeVerifier: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-collaborator-next-auth.pkce.code_verifier"
          : "collaborator-next-auth.pkce.code_verifier",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production", maxAge: 900 },
    },
    nonce: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-collaborator-next-auth.nonce"
          : "collaborator-next-auth.nonce",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },

  pages: {
    signIn: "/accept-invitation",
    signOut: "/login",
    error: "/login",
  },

  debug: process.env.NODE_ENV === "development",
};
