import { prisma } from "@/lib/database/prisma";

/**
 * Microsoft OAuth authentication utilities
 */

export interface MicrosoftTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface MicrosoftCalendarEvent {
  id: string;
  subject: string;
  body?: {
    contentType: string;
    content: string;
  };
  start?: {
    dateTime: string;
    timeZone: string;
  };
  end?: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      countryOrRegion?: string;
    };
  };
  webLink?: string;
}

export async function refreshMicrosoftToken(refreshToken: string): Promise<string> {
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.MICROSOFT_CALENDAR_TENANT_ID || "common"}/oauth2/v2.0/token`;

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CALENDAR_CLIENT_ID || "",
    client_secret: process.env.MICROSOFT_CALENDAR_CLIENT_SECRET || "",
    refresh_token: refreshToken,
    grant_type: "refresh_token",
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
    console.error("Error refreshing Microsoft token:", error);
    throw new Error("Failed to refresh Microsoft access token");
  }

  const data: MicrosoftTokenResponse = await response.json();
  return data.access_token;
}

export async function getMicrosoftAccessToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      microsoftCalendarAccessToken: true,
      microsoftCalendarRefreshToken: true,
      microsoftCalendarTokenExpiry: true,
    },
  });

  if (!user?.microsoftCalendarRefreshToken) {
    return null;
  }

  // Check if token is still valid (with 5 minute buffer)
  if (
    user.microsoftCalendarAccessToken &&
    user.microsoftCalendarTokenExpiry &&
    user.microsoftCalendarTokenExpiry > new Date(Date.now() + 5 * 60 * 1000)
  ) {
    return user.microsoftCalendarAccessToken;
  }

  // Token is expired or expiring soon, refresh it
  try {
    const newAccessToken = await refreshMicrosoftToken(user.microsoftCalendarRefreshToken);

    // Update user with new token and expiry
    const expiresIn = 3600; // Default to 1 hour if not specified
    const newExpiry = new Date(Date.now() + expiresIn * 1000);

    await prisma.user.update({
      where: { id: userId },
      data: {
        microsoftCalendarAccessToken: newAccessToken,
        microsoftCalendarTokenExpiry: newExpiry,
      },
    });

    return newAccessToken;
  } catch (error) {
    console.error("Error refreshing Microsoft access token:", error);
    return null;
  }
}

export async function makeMicrosoftApiRequest<T>(
  userId: string,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await getMicrosoftAccessToken(userId);

  if (!accessToken) {
    throw new Error("Microsoft calendar not connected");
  }

  const response = await fetch(`https://graph.microsoft.com/v1.0${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Microsoft API request failed:", error);
    throw new Error(`Microsoft API request failed: ${response.statusText}`);
  }

  return response.json();
}

export async function revokeMicrosoftTokens(userId: string): Promise<void> {
  // Clear Microsoft calendar tokens from user record
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
