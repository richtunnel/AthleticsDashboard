import { google } from "googleapis";
import { prisma } from "@/lib/database/prisma";
import crypto from "crypto";

/**
 * Service for handling Google OAuth incremental authorization
 * Allows requesting additional scopes after initial authentication
 */

export interface IncrementalAuthResult {
  success: boolean;
  authUrl?: string;
  error?: string;
}

export interface CallbackResult {
  success: boolean;
  scopes?: string[];
  error?: string;
}

// Define available scope sets
export const GOOGLE_SCOPES = {
  PROFILE: ["openid", "email", "profile"] as string[],
  CALENDAR: [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
  ] as string[],
  CONTACTS: ["https://www.googleapis.com/auth/contacts.readonly"] as string[],
};

export type ScopeType = keyof typeof GOOGLE_SCOPES;

/**
 * Generate OAuth URL for requesting additional scopes
 */
export async function initiateIncrementalAuth(userId: string, scopeType: ScopeType, redirectUrl: string): Promise<IncrementalAuthResult> {
  try {
    // Get user's existing account
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
    });

    if (!account) {
      return {
        success: false,
        error: "Google account not connected",
      };
    }

    // Check if user already has these scopes
    const requestedScopes = GOOGLE_SCOPES[scopeType];
    const existingScopes = account.scope?.split(" ") || [];
    const hasAllScopes = requestedScopes.every((scope) => existingScopes.includes(scope));

    if (hasAllScopes && account.refresh_token) {
      return {
        success: true,
        error: "Scopes already granted",
      };
    }

    // ✅ FIXED: Use the same OAuth client as NextAuth for incremental auth
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, redirectUrl);

    // Generate state token for CSRF protection
    const state = crypto.randomBytes(32).toString("hex");

    // Store state token with expiry (5 minutes)
    await prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: state,
        resetTokenExpiry: new Date(Date.now() + 5 * 60 * 1000),
      },
    });

    // Generate authorization URL with incremental authorization
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: requestedScopes,
      include_granted_scopes: true, // KEY: Include previously granted scopes
      state,
      prompt: "consent", // Force consent screen to get refresh token
      login_hint: account.providerAccountId ? undefined : undefined, // Optional: hint which account to use
    });

    return {
      success: true,
      authUrl,
    };
  } catch (error) {
    console.error("[IncrementalAuth] Error initiating auth:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Handle OAuth callback and update account with new tokens
 */
export async function handleIncrementalAuthCallback(userId: string, code: string, state: string, redirectUrl: string): Promise<CallbackResult> {
  try {
    // Verify state token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        resetToken: true,
        resetTokenExpiry: true,
      },
    });

    if (!user || !user.resetToken || user.resetToken !== state || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return {
        success: false,
        error: "Invalid or expired state token",
      };
    }

    // Clear state token
    await prisma.user.update({
      where: { id: userId },
      data: {
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    // ✅ FIXED: Use the same OAuth client as NextAuth
    const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, redirectUrl);

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return {
        success: false,
        error: "No access token received",
      };
    }

    // Get user's existing account
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
    });

    if (!account) {
      return {
        success: false,
        error: "Google account not found",
      };
    }

    // Merge scopes (new + existing)
    const existingScopes = account.scope?.split(" ") || [];
    const newScopes = tokens.scope?.split(" ") || [];
    const mergedScopes = Array.from(new Set([...existingScopes, ...newScopes]));

    // Update account with new tokens
    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || account.refresh_token,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : account.expires_at,
        scope: mergedScopes.join(" "),
      },
    });

    // Also update User table for calendar-specific tokens
    if (newScopes.some((scope) => scope.includes("calendar"))) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { googleCalendarRefreshToken: true },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          googleCalendarAccessToken: tokens.access_token,
          googleCalendarRefreshToken: tokens.refresh_token || existingUser?.googleCalendarRefreshToken || null,
          calendarTokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        },
      });
    }

    return {
      success: true,
      scopes: mergedScopes,
    };
  } catch (error) {
    console.error("[IncrementalAuth] Error handling callback:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check if user has granted specific scopes
 */
export async function hasScopes(userId: string, scopeType: ScopeType): Promise<boolean> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        scope: true,
      },
    });

    if (!account || !account.scope) {
      return false;
    }

    const requestedScopes = GOOGLE_SCOPES[scopeType];
    const existingScopes = account.scope.split(" ");

    return requestedScopes.every((scope) => existingScopes.includes(scope));
  } catch (error) {
    console.error("[IncrementalAuth] Error checking scopes:", error);
    return false;
  }
}

/**
 * Get all granted scopes for a user
 */
export async function getGrantedScopes(userId: string): Promise<string[]> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
      select: {
        scope: true,
      },
    });

    if (!account || !account.scope) {
      return [];
    }

    return account.scope.split(" ");
  } catch (error) {
    console.error("[IncrementalAuth] Error getting scopes:", error);
    return [];
  }
}

/**
 * Revoke specific scopes (disconnect feature)
 */
export async function revokeScopes(userId: string, scopeType: ScopeType): Promise<boolean> {
  try {
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "google",
      },
    });

    if (!account) {
      return false;
    }

    const scopesToRevoke = GOOGLE_SCOPES[scopeType];
    const existingScopes = account.scope?.split(" ") || [];
    const remainingScopes = existingScopes.filter((scope) => !scopesToRevoke.includes(scope));

    // Update account with remaining scopes
    await prisma.account.update({
      where: { id: account.id },
      data: {
        scope: remainingScopes.join(" "),
      },
    });

    // Clear calendar-specific tokens if revoking calendar
    if (scopeType === "CALENDAR") {
      await prisma.user.update({
        where: { id: userId },
        data: {
          googleCalendarAccessToken: null,
          googleCalendarRefreshToken: null,
          calendarTokenExpiry: null,
          googleCalendarId: null,
          googleCalendarEmail: null,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("[IncrementalAuth] Error revoking scopes:", error);
    return false;
  }
}
