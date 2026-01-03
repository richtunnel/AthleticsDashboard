export const ALLOWED_SETTINGS_ROLES = {
  ATHLETIC_DIRECTOR: "ATHLETIC_DIRECTOR",
  ASSISTANT_AD: "ASSISTANT_AD",
  COACH: "COACH",
  STAFF: "STAFF",
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type AllowedSettingsRole = (typeof ALLOWED_SETTINGS_ROLES)[keyof typeof ALLOWED_SETTINGS_ROLES];

export const ROLE_OPTIONS = [
  { label: "Athletic Director", value: ALLOWED_SETTINGS_ROLES.ATHLETIC_DIRECTOR },
  { label: "Assistant AD", value: ALLOWED_SETTINGS_ROLES.ASSISTANT_AD },
  { label: "Coach", value: ALLOWED_SETTINGS_ROLES.COACH },
  { label: "Staff", value: ALLOWED_SETTINGS_ROLES.STAFF },
  { label: "Admin", value: ALLOWED_SETTINGS_ROLES.ADMIN },
  { label: "Member", value: ALLOWED_SETTINGS_ROLES.MEMBER },
];
