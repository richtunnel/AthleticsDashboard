export const MEMBER_ACCESS_ORG_ID = "members-org-opletics25";
export const MEMBER_ACCESS_EMAIL = "members+opletics25@opletics.com";

export const MEMBER_SESSION_MAX_AGE_MS = 48 * 60 * 60 * 1000;

const parseCodes = (raw: string | undefined): string[] => {
  if (!raw) return [];
  return raw
    .split(",")
    .map((code) => code.trim().toLowerCase())
    .filter(Boolean);
};

const DEFAULT_DISABLED_CODES = ["opletics25"];

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

  return email === MEMBER_ACCESS_EMAIL || organizationId === MEMBER_ACCESS_ORG_ID;
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
