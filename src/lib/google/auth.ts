import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { getSiteUrl } from "../utils/siteUrl";

/**
 * Creates a standardized Google OAuth2 client
 */
export function createGoogleOAuth2Client(redirectUri?: string): OAuth2Client {
  const defaultRedirectUri = process.env.GOOGLE_REDIRECT_URI || `${getSiteUrl()}/api/auth/calendar-callback`;
  
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirectUri || defaultRedirectUri
  );
  return client;
}

/**
 * Refreshes a Google access token using a refresh token
 */
export async function refreshGoogleToken(refreshToken: string) {
  const oauth2Client = createGoogleOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token!;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw new Error("Failed to refresh access token");
  }
}

/**
 * Gets an authenticated Google Auth client
 */
export async function getGoogleAuthClient(refreshToken: string) {
  const oauth2Client = createGoogleOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return oauth2Client;
}
