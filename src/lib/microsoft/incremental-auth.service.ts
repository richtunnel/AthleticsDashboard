import { prisma } from "@/lib/database/prisma";
import crypto from "crypto";
import { MicrosoftTokenResponse } from "./auth";

/**
 * Service for handling Microsoft OAuth incremental authorization
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

// Define available scope sets for Microsoft Graph API
export const MICROSOFT_SCOPES = {
  PROFILE: ["User.Read"] as string[],
  CALENDAR: [
    "Calendars.ReadWrite",
    "User.Read",
  ] as string[],
  CONTACTS: ["Contacts.Read", "User.Read"] as string[],
};

export type ScopeType = keyof typeof MICROSOFT_SCOPES;

/**
 * Generate OAuth URL for requesting additional scopes
 */
export async function initiateIncrementalAuth(userId: string, scopeType: ScopeType, redirectUrl: string): Promise<IncrementalAuthResult> {
  try {
    // Get user's existing account
    const account = await prisma.account.findFirst({
      where: {
        userId,
        provider: "microsoft",
      },
    });

    if (!account) {
      return {
        success: false,
        error: "Microsoft account not connected",
      };
    }

    // Check if user already has these scopes
    const requestedScopes = MICROSOFT_SCOPES[scopeType];
    const existingScopes = account.scope?.split(" ") || [];
    const hasAllScopes = requestedScopes.every((scope) => existingScopes.includes(scope));

    if (hasAllScopes && account.refresh_token) {
      return {
        success: true,
        error: "Scopes already granted",
      };
    }

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

    // Build authorization URL for Microsoft
    const authUrl = new URL(`https://login.microsoftonline.com/${process.env.MICROSOFT_CALENDAR_TENANT_ID || "common"}/oauth2/v2.0/authorize`);

    authUrl.searchParams.append("client_id", process.env.MICROSOFT_CALENDAR_CLIENT_ID || "");
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("redirect_uri", redirectUrl);
    authUrl.searchParams.append("response_mode", "query");
    authUrl.searchParams.append("scope", requestedScopes.join(" "));
    authUrl.searchParams.append("state", state);
    authUrl.searchParams.append("prompt", "consent");

    return {
      success: true,
      authUrl: authUrl.toString(),
    };
  } catch (error) {
    console.error("[Microsoft IncrementalAuth] Error initiating auth:", error);
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

    // Exchange code for tokens
    const tokenEndpoint = `https://login.microsoftonline.com/${process.env.MICROSOFT_CALENDAR_TENANT_ID || "common"}/oauth2/v2.0/token`;

    const params = new URLSearchParams({
      client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID || "",
      client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || "",
      code,
      redirect_uri: redirectUrl,
      grant_type: "authorization_code",
    });

    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[Microsoft IncrementalAuth] Token exchange failed:", error);
      return {
        success: false,
        error: "Failed to exchange code for tokens",
      };
    }

    const tokens: MicrosoftTokenResponse = await response.json();

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
        provider: "microsoft",
      },
    });

    if (!account) {
      return {
        success: false,
        error: "Microsoft account not found",
      };
    }

    // Merge scopes (new + existing)
    const existingScopes = account.scope?.split(" ") || [];
    const newScopes = tokens.scope?.split(" ") || [];
    const mergedScopes = Array.from(new Set([...existingScopes, ...newScopes]));

    // Update account with new tokens
    const expiresAt = tokens.expires_in ? Math.floor(Date.now() / 1000) + tokens.expires_in : account.expires_at;

    await prisma.account.update({
      where: { id: account.id },
      data: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || account.refresh_token,
        expires_at: expiresAt,
        scope: mergedScopes.join(" "),
      },
    });

    // Also update User table for calendar-specific tokens
    if (newScopes.some((scope) => scope.includes("Calendars"))) {
      const existingUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { microsoftCalendarRefreshToken: true },
      });

      await prisma.user.update({
        where: { id: userId },
        data: {
          microsoftCalendarAccessToken: tokens.access_token,
          microsoftCalendarRefreshToken: tokens.refresh_token || existingUser?.microsoftCalendarRefreshToken || null,
          microsoftCalendarTokenExpiry: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
        },
      });
    }

    return {
      success: true,
      scopes: mergedScopes,
    };
  } catch (error) {
    console.error("[Microsoft IncrementalAuth] Error handling callback:", error);
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
        provider: "microsoft",
      },
      select: {
        scope: true,
      },
    });

    if (!account || !account.scope) {
      return false;
    }

    const requestedScopes = MICROSOFT_SCOPES[scopeType];
    const existingScopes = account.scope.split(" ");

    return requestedScopes.every((scope) => existingScopes.includes(scope));
  } catch (error) {
    console.error("[Microsoft IncrementalAuth] Error checking scopes:", error);
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
        provider: "microsoft",
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
    console.error("[Microsoft IncrementalAuth] Error getting scopes:", error);
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
        provider: "microsoft",
      },
    });

    if (!account) {
      return false;
    }

    const scopesToRevoke = MICROSOFT_SCOPES[scopeType];
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
          microsoftCalendarAccessToken: null,
          microsoftCalendarRefreshToken: null,
          microsoftCalendarTokenExpiry: null,
          microsoftCalendarId: null,
          microsoftCalendarEmail: null,
        },
      });
    }

    return true;
  } catch (error) {
    console.error("[Microsoft IncrementalAuth] Error revoking scopes:", error);
    return false;
  }
}
