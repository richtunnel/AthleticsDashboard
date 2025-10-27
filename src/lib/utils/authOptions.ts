import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database/prisma";
import bcrypt from "bcryptjs";
import { LoginTrackingPayload, recordUserLogin } from "@/lib/services/loginTracking.service";
import { extractRequestMetadataFromHeaders, getRequestMetadataFromContext } from "@/lib/utils/requestMetadata";
import { emailService } from "@/lib/services/email.service";

// Wrap the PrismaAdapter to customize createUser
const adapter = PrismaAdapter(prisma);
const customAdapter = {
  ...adapter,
  async createUser(user: any) {
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
    // Create user with their own organization
    const newUser = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        role: "ATHLETIC_DIRECTOR", // Set default role
        plan: plan,
        stripeCustomerId,
        trialEnd: plan === "free_trial_plan" ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null,
        organization: {
          create: {
            name: user.name ? `${user.name}'s Organization` : "My Organization",
            timezone: "America/New_York", // Set default timezone
            // Add any other required organization fields from your schema
          },
        },
      },
      include: {
        organization: true,
      },
    });

    // Send welcome email (non-blocking)
    try {
      await emailService.sendWelcomeEmail({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      });
    } catch (welcomeEmailError) {
      console.error("Failed to send welcome email for OAuth user:", welcomeEmailError);
      // Don't fail the user creation if welcome email fails
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

const recordUserLoginSafely = async (payload: LoginTrackingPayload) => {
  try {
    await recordUserLogin(payload);
  } catch (error) {
    console.error("Login tracking failed", {
      provider: payload.provider,
      userId: payload.userId,
      error,
    });
  }
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
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/calendar",
            "https://www.googleapis.com/auth/contacts.readonly",
            "https://www.googleapis.com/auth/userinfo.email",
          ].join(" "),
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

        await recordUserLoginSafely({
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
  ],

  events: {
    async signIn({ user, account }) {
      if (!account || account.provider === "credentials") {
        return;
      }

      const metadata = await getRequestMetadataFromContext();
      const userId = typeof user?.id === "string" ? user.id : null;

      if (!userId) {
        return;
      }

      await recordUserLoginSafely({
        userId,
        provider: account.provider,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
      });
    },
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google") {
        const email = profile?.email ?? user?.email ?? undefined;

        if (email) {
          const existingUser = (await prisma.user.findUnique(
            {
              where: { email },
              select: {
                id: true,
                googleCalendarEmail: true,
              },
            } as any,
          )) as { id: string; googleCalendarEmail?: string | null } | null;

          if (existingUser) {
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
        }
      }

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
        session.user.googleCalendarRefreshToken = token.googleCalendarRefreshToken;
        session.user.googleCalendarAccessToken = token.googleCalendarAccessToken;
        session.user.calendarTokenExpiry = token.calendarTokenExpiry;
        session.user.googleCalendarEmail = token.googleCalendarEmail;
      }
      return session;
    },

    async jwt({ token, user, account, trigger }) {
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

      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organization = user.organization;
        token.googleCalendarRefreshToken = user.googleCalendarRefreshToken ?? undefined;
        token.googleCalendarAccessToken = user.googleCalendarAccessToken ?? undefined;
        token.calendarTokenExpiry = user.calendarTokenExpiry ?? undefined;
        token.googleCalendarEmail = user.googleCalendarEmail ?? undefined;
      }

      if (account?.provider === "google" && token.email) {
        const dbUser = (await prisma.user.findUnique(
          {
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
            },
          } as any,
        )) as any;

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
          token.googleCalendarRefreshToken = dbUser.googleCalendarRefreshToken ?? undefined;
          token.googleCalendarAccessToken = dbUser.googleCalendarAccessToken ?? undefined;
          token.calendarTokenExpiry = dbUser.calendarTokenExpiry ?? undefined;
          token.googleCalendarEmail = dbUser.googleCalendarEmail ?? undefined;
        }
      }

      if ((trigger === "update" || !token.organization || !token.googleCalendarEmail) && token.email) {
        const dbUser = (await prisma.user.findUnique(
          {
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
              googleCalendarRefreshToken: true,
              googleCalendarAccessToken: true,
              calendarTokenExpiry: true,
              googleCalendarEmail: true,
            },
          } as any,
        )) as any;

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
          token.googleCalendarRefreshToken = dbUser.googleCalendarRefreshToken ?? undefined;
          token.googleCalendarAccessToken = dbUser.googleCalendarAccessToken ?? undefined;
          token.calendarTokenExpiry = dbUser.calendarTokenExpiry ?? undefined;
          token.googleCalendarEmail = dbUser.googleCalendarEmail ?? undefined;
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
          return baseUrl;
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

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
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
