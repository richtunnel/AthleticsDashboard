export const MEMBER_ACCESS_ORG_ID_PREFIX = "members-org-opletics25-";
export const MEMBER_ACCESS_EMAIL_PREFIX = "member-";
export const MEMBER_ACCESS_EMAIL_DOMAIN = "@opletics.com";
export const MEMBER_ACCESS_CODE = "opletics25";

export const MEMBER_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a unique member session ID based on device/browser fingerprint
 * This ensures each user on a device gets their own account
 */
export const generateMemberSessionId = (): string => {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

/**
 * Generate a unique email for a temporary member session
 */
export const generateMemberEmail = (sessionId: string): string => {
  return `${MEMBER_ACCESS_EMAIL_PREFIX}${sessionId}${MEMBER_ACCESS_EMAIL_DOMAIN}`;
};

/**
 * Generate a unique organization ID for a temporary member
 */
export const generateMemberOrgId = (sessionId: string): string => {
  return `${MEMBER_ACCESS_ORG_ID_PREFIX}${sessionId}`;
};

/**
 * Generate organization name for a member
 */
export const generateMemberOrgName = (): string => {
  return `Opletics Member - ${new Date().toLocaleDateString()}`;
};

const parseCodes = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
};

const DEFAULT_DISABLED_CODES: string[] = [];

export const DISABLED_MEMBER_ACCESS_CODES = new Set<string>([
  ...DEFAULT_DISABLED_CODES,
  ...parseCodes(process.env.DISABLED_MEMBER_ACCESS_CODES),
]);

export const normalizeMemberAccessCode = (code: string | undefined | null): string | null => {
  const normalized = code?.trim().toLowerCase();
  return normalized ? normalized : null;
};

export const isMemberAccessCodeDisabled = (code: string | undefined | null): boolean => {
  const normalized = normalizeMemberAccessCode(code);
  if (!normalized) return false;
  return DISABLED_MEMBER_ACCESS_CODES.has(normalized);
};

export const isMemberAccessToken = (token: any): boolean => {
  if (!token) return false;

  const email = typeof token.email === "string" ? token.email.toLowerCase() : null;
  const organizationId = typeof token.organizationId === "string" ? token.organizationId : null;

  // Check if email matches member access pattern (member-{sessionId}@opletics.com)
  if (email && email.startsWith(MEMBER_ACCESS_EMAIL_PREFIX) && email.endsWith(MEMBER_ACCESS_EMAIL_DOMAIN)) {
    return true;
  }

  // Check if organization ID matches member access pattern
  if (organizationId && organizationId.startsWith(MEMBER_ACCESS_ORG_ID_PREFIX)) {
    return true;
  }

  return false;
};

export const getMemberAccessIssuedAtMs = (token: any): number | null => {
  if (!token) return null;

  if (typeof token.memberAccessIssuedAt === "number") {
    return token.memberAccessIssuedAt;
  }

  if (typeof token.iat === "number") {
    return token.iat * 1000;
  }

  return null;
};

export const getMemberAccessExpiresAtMs = (token: any): number | null => {
  if (!token) return null;

  if (typeof token.memberAccessExpiresAt === "number") {
    return token.memberAccessExpiresAt;
  }

  const issuedAtMs = getMemberAccessIssuedAtMs(token);
  if (!issuedAtMs) return null;

  return issuedAtMs + MEMBER_SESSION_MAX_AGE_MS;
};

export const isMemberAccessSessionExpired = (token: any, nowMs = Date.now()): boolean => {
  const expiresAtMs = getMemberAccessExpiresAtMs(token);
  if (!expiresAtMs) return false;
  return nowMs >= expiresAtMs;
};

/**
 * Check if a session ID is expired based on the timestamp embedded in it
 */
export const isSessionIdExpired = (sessionId: string, nowMs = Date.now()): boolean => {
  if (!sessionId || !sessionId.startsWith("session_")) return false;

  const parts = sessionId.split("_");
  if (parts.length < 2) return false;

  const timestamp = parseInt(parts[1], 10);
  if (isNaN(timestamp)) return false;

  const expiresAt = timestamp + MEMBER_SESSION_MAX_AGE_MS;
  return nowMs >= expiresAt;
};
