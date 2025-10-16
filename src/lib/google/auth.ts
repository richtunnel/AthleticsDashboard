import { google } from "googleapis";

export async function refreshGoogleToken(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.NEXTAUTH_URL + "/api/auth/callback/google");

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    return credentials.access_token!;
  } catch (error) {
    console.error("Error refreshing access token:", error);
    throw new Error("Failed to refresh access token");
  }
}

// Alternatively, get a fresh token and return the oauth2Client
export async function getGoogleAuthClient(refreshToken: string) {
  const oauth2Client = new google.auth.OAuth2(process.env.GOOGLE_CALENDAR_CLIENT_ID, process.env.GOOGLE_CALENDAR_CLIENT_SECRET, process.env.NEXTAUTH_URL + "/api/auth/callback/google");

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  // This will automatically refresh if needed
  return oauth2Client;
}
