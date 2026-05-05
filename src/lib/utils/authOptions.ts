import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database/prisma";
import bcrypt from "bcryptjs";
import { encode as defaultJwtEncode, decode as defaultJwtDecode } from "next-auth/jwt";
import { cookies } from "next/headers";
import { LoginTrackingPayload, recordUserLogin } from "@/lib/services/loginTracking.service";
import { extractRequestMetadataFromHeaders, getRequestMetadataFromContext } from "@/lib/utils/requestMetadata";
import { emailService } from "@/lib/services/email.service";
import { runNonCritical } from "@/lib/utils/nonCritical";
import { trackServerEvent, identifyServerUser } from "@/lib/analytics/mixpanel.server";
import { isSignupBlocked } from "@/lib/services/signup-log.service";
import { createSampleGame } from "@/lib/services/sample-game.service";
import { createInitialColumnPreferences } from "@/lib/services/initial-columns.service";
import { generateUniqueShareCode } from "@/lib/utils/shareCode";
import { 
  INVITATION_COOKIE_NAME, 
  checkInvitationCookie, 
  clearInvitationCookie,
  setBypassOnboardingCookie,
  shouldBypassOnboarding,
  clearBypassOnboardingCookie
} from "@/lib/utils/invitation";
import {
  CollaborativeRole,
  UserRole,
} from "@prisma/client";
import {
  generateMemberSessionId,
  generateMemberEmail,
  generateMemberOrgId,
  generateMemberOrgName,
  MEMBER_SESSION_MAX_AGE_MS,
  getMemberAccessExpiresAtMs,
  isMemberAccessCodeDisabled,
  isMemberAccessToken,
  normalizeMemberAccessCode,
} from "@/lib/utils/memberAccess";

const MEMBER_ACCESS_CODE = normalizeMemberAccessCode(process.env.MEMBER_ACCESS_CODE) ?? "vip.opletics.com";

// Wrap the PrismaAdapter to customize createUser
const adapter = PrismaAdapter(prisma);
const customAdapter = {
  ...adapter,
  async createUser(user: any) {
    // Check if email is blocked due to recent account deletion (90-day rule)
    const signupCheck = await isSignupBlocked(user.email);
    if (signupCheck.blocked) {
      console.error("[OAuth] Signup blocked for email:", user.email, "Expires:", signupCheck.expiresAt);
      throw new Error("This email was used for an account that was recently deleted. Please wait before signing up again or contact support.");
    }

    // Extract plan from user data if available (passed from callback URL)
    const plan = user.plan || "free_trial_plan";

    let stripeCustomerId = null;

    // Create Stripe customer if plan is selected (not free trial) and we have the required environment
    if (plan && plan !== "free_trial_plan") {
      try {
        // Import the Stripe helper function
        const { getStripe } = await import("@/lib/stripe");
        const stripe = getStripe();
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: {
            plan: plan,
            source: "google_oauth",
          },
        });
        stripeCustomerId = customer.id;
      } catch (stripeError) {
        console.error("Stripe customer creation error during OAuth:", stripeError);
        // Continue with user creation even if Stripe fails - we can retry later
      }
    }
    // Check if this is a parent signup (indicated by plan containing "parent")
    const isParentPlan = typeof plan === "string" && plan.includes("parent");

    // Generate a unique share code for the new user
    const shareCode = await generateUniqueShareCode();

    // Check if user is joining via an invitation
    const invitationData = await checkInvitationCookie();
    let newUser: any;

    if (invitationData) {
      // Join existing organization (no sample games, no welcome email for collaborators)
      console.log(`[Invitation] Creating user ${user.email} as collaborator in org ${invitationData.organizationId}`);
      newUser = await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified,
          role: invitationData.role,
          plan: "free_trial_plan",
          stripeCustomerId,
          shareCode,
          trialEnd: null,
          organizationId: invitationData.organizationId,
          // Copy school details from the inviter
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
        include: {
          organization: true,
        },
      });

      // Clear the invitation cookie now that user has been created
      await clearInvitationCookie();

      // Set a temporary cookie to bypass onboarding redirect
      await setBypassOnboardingCookie();

      // Track collaboration signup in Mixpanel (non-blocking)
      void runNonCritical(() => {
        trackServerEvent("Collaborator Signup", {
          distinct_id: newUser.id,
          signup_method: "google",
          email: newUser.email,
          name: newUser.name,
          invited_by: invitationData.ownerId,
          organization_id: invitationData.organizationId,
          role: newUser.role,
        });
        identifyServerUser(newUser.id, {
          $email: newUser.email,
          $name: newUser.name,
          role: newUser.role,
          signup_method: "google",
          signup_date: new Date().toISOString(),
        });
      }, `mixpanel tracking for collaborator ${newUser.id}`);
    } else {
      // Normal signup flow - create user with their own organization
      newUser = await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          image: user.image,
          emailVerified: user.emailVerified,
          role: isParentPlan ? "PARENT" : "ATHLETIC_DIRECTOR", // Set role based on plan type
          plan: plan,
          stripeCustomerId,
          shareCode,
          trialEnd: plan === "free_trial_plan" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
          organization: {
            create: {
              name: user.name 
                ? (isParentPlan ? `${user.name}'s Family` : `${user.name}'s Organization`)
                : (isParentPlan ? "My Family" : "My Organization"),
              timezone: "America/New_York", // Set default timezone
              // Add any other required organization fields from your schema
            },
          },
        },
        include: {
          organization: true,
        },
      });

      // Create sample game for new user (non-blocking)
      void runNonCritical(
        () =>
          createSampleGame({
            userId: newUser.id,
            organizationId: newUser.organizationId,
          }),
        `sample game creation for user ${newUser.id}`
      );

      // Create initial column preferences for new user (non-blocking)
      // This ensures they see only the 5 essential columns: Date, Sport, Level, Location, Actions
      void runNonCritical(() => createInitialColumnPreferences(newUser.id), `initial column preferences for user ${newUser.id}`);

      // Send welcome email (non-blocking)
      if (newUser.email) {
        void runNonCritical(
          () =>
            emailService.sendWelcomeEmail({
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
            }),
          `welcome email for user ${newUser.id}`
        );
      }

      // Track Google OAuth signup in Mixpanel (non-blocking)
      void runNonCritical(() => {
        trackServerEvent("User Signup", {
          distinct_id: newUser.id,
          signup_method: "google",
          plan: newUser.plan,
          email: newUser.email,
          name: newUser.name,
        });
        identifyServerUser(newUser.id, {
          $email: newUser.email,
          $name: newUser.name,
          plan: newUser.plan,
          role: newUser.role,
          signup_method: "google",
          signup_date: new Date().toISOString(),
        });
      }, `mixpanel tracking for user ${newUser.id}`);
    }

    return newUser;
  },

  // ✅ Override linkAccount to remove unsupported fields
  async linkAccount(account: any) {
    // Remove fields that aren't in the Prisma schema
    const { refresh_token_expires_in, ...accountData } = account;

    // Call the original linkAccount with cleaned data
    return adapter.linkAccount!(accountData);
  },
} as any;

const queueLoginTracking = (payload: LoginTrackingPayload) => {
  const providerLabel = payload.provider || "unknown";
  const label = `login tracking (${providerLabel}) for user ${payload.userId}`;
  void runNonCritical(() => recordUserLogin(payload), label);
};

export const authOptions: NextAuthOptions = {
  adapter: customAdapter, // Use customAdapter instead of PrismaAdapter(prisma)

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
          // ✅ INCREMENTAL AUTHORIZATION: Only request basic profile scopes initially
          // Calendar and Contacts scopes will be requested on-demand when needed
          scope: ["openid", "email", "profile"].join(" "),
        },
      },
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                timezone: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error("No user found with this email");
        }

        if (!user.hashedPassword) {
          throw new Error("Please sign in with Google");
        }

        const isValid = await bcrypt.compare(credentials.password, user.hashedPassword);

        if (!isValid) {
          throw new Error("Invalid password");
        }

        const metadata = extractRequestMetadataFromHeaders(req?.headers);

        queueLoginTracking({
          userId: user.id,
          provider: "credentials",
          ip: metadata.ip,
          userAgent: metadata.userAgent,
        });

        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          image: user.image,
          role: user.role,
          organizationId: user.organizationId || undefined,
          organization: user.organization || undefined,
          googleCalendarRefreshToken: user.googleCalendarRefreshToken ?? undefined,
          googleCalendarAccessToken: user.googleCalendarAccessToken ?? undefined,
          calendarTokenExpiry: user.calendarTokenExpiry ?? undefined,
          googleCalendarEmail: (user as any).googleCalendarEmail ?? undefined,
        };
      },
    }),

    CredentialsProvider({
      id: "member-code",
      name: "Member Code",
      credentials: {
        code: { label: "Member Code", type: "text" },
        sessionId: { label: "Session ID", type: "text" },
      },
      async authorize(credentials) {
        const code = normalizeMemberAccessCode(credentials?.code);

        if (!code) {
          throw new Error("Invalid member code");
        }

        if (isMemberAccessCodeDisabled(code)) {
          throw new Error("Member code deactivated");
        }

        if (code !== MEMBER_ACCESS_CODE) {
          throw new Error("Invalid member code");
        }

        // Generate a unique session ID for this member
        const sessionId = credentials?.sessionId || generateMemberSessionId();
        const memberEmail = generateMemberEmail(sessionId);
        const memberOrgId = generateMemberOrgId(sessionId);

        // First, check if this session already exists and clean up any old data
        // This ensures a fresh start for each member
        const existingUser = await prisma.user.findUnique({
          where: { email: memberEmail },
        });

        if (existingUser) {
          // Delete the old session data to ensure fresh start
          await prisma.user.delete({
            where: { id: existingUser.id },
          });
          console.log(`[MemberAccess] Cleaned up previous session for: ${memberEmail}`);
        }

        // Create a unique organization for this member
        const org = await prisma.organization.upsert({
          where: { id: memberOrgId },
          update: {
            name: generateMemberOrgName(),
            timezone: "America/New_York",
          },
          create: {
            id: memberOrgId,
            name: generateMemberOrgName(),
            timezone: "America/New_York",
          },
        });

        // Create a new individual user account for this member
        // Add placeholder school details to bypass onboarding checks
        // Member access users are not expected to complete onboarding
        const user = await prisma.user.create({
          data: {
            email: memberEmail,
            name: "Member",
            role: "ATHLETIC_DIRECTOR",
            organizationId: org.id,
            plan: "free_trial_plan",
            trialEnd: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hour trial
            // Placeholder values to bypass onboarding checks
            schoolName: "Member Access",
            teamName: "Member Team",
            schoolAddress: "Member Location",
          },
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                timezone: true,
              },
            },
          },
        });

        // Create sample game for new member (non-blocking)
        void runNonCritical(async () => {
          await createSampleGame({
            userId: user.id,
            organizationId: user.organizationId,
          });

          await createInitialColumnPreferences(user.id);
        }, `member access bootstrap for user ${user.id}`);

        const issuedAt = Date.now();

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          organizationId: user.organizationId,
          organization: user.organization,
          googleCalendarRefreshToken: user.googleCalendarRefreshToken ?? undefined,
          googleCalendarAccessToken: user.googleCalendarAccessToken ?? undefined,
          calendarTokenExpiry: user.calendarTokenExpiry ?? undefined,
          googleCalendarEmail: user.googleCalendarEmail ?? undefined,
          memberAccessCode: code,
          memberAccessSessionId: sessionId,
          memberAccessIssuedAt: issuedAt,
          memberAccessExpiresAt: issuedAt + MEMBER_SESSION_MAX_AGE_MS,
        };
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
                select: {
                  id: true,
                  googleCalendarEmail: true,
                },
              });

              // Allow account creation during signup flow
              // The customAdapter.createUser will handle signup validation (90-day block check)
              if (existingUser) {
                // User exists - update their Google Calendar tokens
                const updateData: Record<string, any> = {};

                if (account.refresh_token) {
                  updateData.googleCalendarRefreshToken = account.refresh_token;
                }

                if (account.access_token) {
                  updateData.googleCalendarAccessToken = account.access_token;
                }

                if (typeof account.expires_at === "number") {
                  updateData.calendarTokenExpiry = new Date(account.expires_at * 1000);
                }

                updateData.googleCalendarEmail = profile?.email ?? existingUser.googleCalendarEmail ?? email;

                if (Object.keys(updateData).length > 0) {
                  await prisma.user.update({
                    where: { id: existingUser.id },
                    data: updateData,
                  });
                }
              }
              // If user doesn't exist, allow NextAuth + PrismaAdapter to create them
              // The customAdapter.createUser method will check for 90-day signup blocks
            } catch (googleUpdateError) {
              console.error("Failed to check/update Google account during sign-in", {
                email,
                error: googleUpdateError,
              });
              // Don't block - let it proceed
            }
          }
        }

        const provider = account?.provider;

        if (user && typeof user.id === "string" && provider && provider !== "credentials") {
          const metadata = await getRequestMetadataFromContext();
          queueLoginTracking({
            userId: user.id,
            provider,
            ip: metadata.ip,
            userAgent: metadata.userAgent,
          });
        }

        return true; // Always return true for Google OAuth
      } catch (error) {
        console.error("SignIn callback error:", error);
        return true; // Don't block on errors
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
        session.user.googleCalendarRefreshToken = token.googleCalendarRefreshToken;
        session.user.googleCalendarAccessToken = token.googleCalendarAccessToken;
        session.user.calendarTokenExpiry = token.calendarTokenExpiry;
        session.user.googleCalendarEmail = token.googleCalendarEmail;
        // Include school onboarding fields from token
        session.user.schoolName = token.schoolName;
        session.user.teamName = token.teamName;
        session.user.schoolAddress = token.schoolAddress;
        session.user.city = token.city;
      }

      if (isMemberAccessToken(token)) {
        const memberExpiresAtMs = getMemberAccessExpiresAtMs(token);
        if (memberExpiresAtMs) {
          session.expires = new Date(memberExpiresAtMs).toISOString();
        }
      }

      return session;
    },

    async jwt({ token, user, account, trigger }) {
      // Skip database lookups for member access tokens to avoid redirect loops
      if (isMemberAccessToken(token)) {
        const nowMs = Date.now();
        
        if (account?.provider === "member-code" || (user as any)?.memberAccessCode) {
          const issuedAtMs = typeof (user as any)?.memberAccessIssuedAt === "number" ? (user as any).memberAccessIssuedAt : nowMs;
          token.memberAccessCode = normalizeMemberAccessCode((user as any)?.memberAccessCode) ?? MEMBER_ACCESS_CODE;
          token.memberAccessSessionId = (user as any)?.memberAccessSessionId;
          token.memberAccessIssuedAt = issuedAtMs;
          token.memberAccessExpiresAt = issuedAtMs + MEMBER_SESSION_MAX_AGE_MS;
        } else if (isMemberAccessToken(token)) {
          const issuedAtMs = typeof token.memberAccessIssuedAt === "number" ? token.memberAccessIssuedAt : typeof token.iat === "number" ? token.iat * 1000 : nowMs;
          token.memberAccessIssuedAt = issuedAtMs;
          token.memberAccessExpiresAt = issuedAtMs + MEMBER_SESSION_MAX_AGE_MS;
          token.memberAccessCode = normalizeMemberAccessCode(token.memberAccessCode) ?? MEMBER_ACCESS_CODE;
          if (!token.memberAccessSessionId) {
            token.memberAccessSessionId = token.email?.replace("@opletics.com", "")?.replace("member-", "") || null;
          }
        }

        if (isMemberAccessCodeDisabled(token.memberAccessCode ?? MEMBER_ACCESS_CODE)) {
          token.memberAccessExpiresAt = nowMs - 1000;
        }

        // For member access tokens, we skip school details check
        // They bypass onboarding entirely
        return token;
      }

      // Save Google tokens when account is first linked
      if (account?.provider === "google" && account.refresh_token && token.email) {
        await prisma.user.update({
          where: { email: token.email },
          data: {
            googleCalendarRefreshToken: account.refresh_token,
            googleCalendarAccessToken: account.access_token,
            calendarTokenExpiry: account.expires_at ? new Date(account.expires_at * 1000) : null,
          },
        });

        // Set them in the token immediately
        token.googleCalendarRefreshToken = account.refresh_token;
        token.googleCalendarAccessToken = account.access_token;
        token.calendarTokenExpiry = account.expires_at ? new Date(account.expires_at * 1000) : undefined;
      }

      // Consolidated database lookup - fetch all necessary fields in one query
      if (token.email && (trigger === "update" || !token.organization || !token.googleCalendarEmail || !token.schoolName)) {
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
            googleCalendarRefreshToken: true,
            googleCalendarAccessToken: true,
            calendarTokenExpiry: true,
            googleCalendarEmail: true,
            // School onboarding fields
            schoolName: true,
            teamName: true,
            schoolAddress: true,
            city: true,
          },
        } as any)) as any;

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
          token.googleCalendarRefreshToken = dbUser.googleCalendarRefreshToken ?? undefined;
          token.googleCalendarAccessToken = dbUser.googleCalendarAccessToken ?? undefined;
          token.calendarTokenExpiry = dbUser.calendarTokenExpiry ?? undefined;
          token.googleCalendarEmail = dbUser.googleCalendarEmail ?? undefined;
          // Include school onboarding fields
          token.schoolName = dbUser.schoolName ?? undefined;
          token.teamName = dbUser.teamName ?? undefined;
          token.schoolAddress = dbUser.schoolAddress ?? undefined;
          token.city = dbUser.city ?? undefined;
        }
      }

      // Handle new user from credentials provider
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organization = user.organization;
        token.googleCalendarRefreshToken = (user as any).googleCalendarRefreshToken ?? undefined;
        token.googleCalendarAccessToken = (user as any).googleCalendarAccessToken ?? undefined;
        token.calendarTokenExpiry = (user as any).calendarTokenExpiry ?? undefined;
        token.googleCalendarEmail = (user as any).googleCalendarEmail ?? undefined;
        // Include school onboarding fields from user
        token.schoolName = (user as any).schoolName ?? undefined;
        token.teamName = (user as any).teamName ?? undefined;
        token.schoolAddress = (user as any).schoolAddress ?? undefined;
        token.city = (user as any).city ?? undefined;
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
          return baseUrl;
        }

        // Check if this is a new user signup (indicated by newUser query param)
        const isNewUser = resolvedUrl.searchParams.has("newUser");

        // Check if this is a parent signup (indicated by callbackUrl containing "parent")
        const isParentSignup = resolvedUrl.pathname.includes("/onboarding/parent") || 
                               url.includes("plan=parent") ||
                               resolvedUrl.searchParams.get("plan")?.includes("parent");

        // For parent signups, redirect to parent onboarding
        if (isParentSignup && isNewUser) {
          return `${baseUrl}/onboarding/parent`;
        }

        // For new users via Google OAuth, redirect to onboarding/details
        // UNLESS they are joining via an invitation (collaborators)
        if (isNewUser && resolvedUrl.pathname === "/dashboard") {
          const bypassOnboarding = await shouldBypassOnboarding();
          if (bypassOnboarding) {
            await clearBypassOnboardingCookie();
            return `${baseUrl}/dashboard?collaboration=accepted`;
          }
          return `${baseUrl}/onboarding/details`;
        }

        if (resolvedUrl.pathname.startsWith("/onboarding")) {
          if (resolvedUrl.pathname === "/onboarding/plans" || 
              resolvedUrl.pathname === "/onboarding/details" ||
              resolvedUrl.pathname.startsWith("/onboarding/parent")) {
            return resolvedUrl.toString();
          }
          return `${baseUrl}/dashboard`;
        }

        if (resolvedUrl.pathname.startsWith("/dashboard")) {
          return resolvedUrl.toString();
        }

        if (resolvedUrl.pathname === "/") {
          return `${baseUrl}/dashboard`;
        }

        return resolvedUrl.toString();
      } catch {
        return baseUrl;
      }
    },
  },

  jwt: {
    async encode(params) {
      const expiresAtMs = typeof (params.token as any)?.memberAccessExpiresAt === "number" ? (params.token as any).memberAccessExpiresAt : null;

      if (expiresAtMs) {
        const remainingSeconds = Math.max(0, Math.floor(expiresAtMs / 1000 - Date.now() / 1000));
        return defaultJwtEncode({ ...params, maxAge: remainingSeconds } as any);
      }

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
      name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/",
    signOut: "/",
    error: "/",
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
