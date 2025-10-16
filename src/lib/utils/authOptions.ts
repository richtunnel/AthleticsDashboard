import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { prisma } from "@/lib/database/prisma";
import bcrypt from "bcryptjs";

// Wrap the PrismaAdapter to customize createUser
const adapter = PrismaAdapter(prisma);
const customAdapter = {
  ...adapter,
  async createUser(user: any) {
    // Create user with their own organization
    const newUser = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        image: user.image,
        emailVerified: user.emailVerified,
        role: "ATHLETIC_DIRECTOR", // Set default role
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

    return newUser;
  },
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
        },
      },
    }),

    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
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

        return {
          id: user.id,
          email: user.email!,
          name: user.name,
          image: user.image,
          role: user.role,
          organizationId: user.organizationId || undefined,
          organization: user.organization || undefined,
        };
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "google" && profile?.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: profile.email },
        });

        if (!existingUser) {
          return true;
        } else {
          return true;
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
      }
      return session;
    },

    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organization = user.organization;
      }

      if (account?.provider === "google" && token.email) {
        const dbUser = await prisma.user.findUnique({
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
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
        }
      }

      if ((trigger === "update" || !token.organization) && token.email) {
        const dbUser = await prisma.user.findUnique({
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
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.organizationId = dbUser.organizationId;
          token.organization = dbUser.organization || undefined;
        }
      }

      return token;
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },

  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  debug: process.env.NODE_ENV === "development",
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
