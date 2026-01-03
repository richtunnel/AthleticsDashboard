export const ALLOWED_SETTINGS_ROLES = {
  ADMIN: "ADMIN",
  MEMBER: "MEMBER",
} as const;

export type AllowedSettingsRole = (typeof ALLOWED_SETTINGS_ROLES)[keyof typeof ALLOWED_SETTINGS_ROLES];

export const ROLE_OPTIONS = [
  { label: "Admin", value: ALLOWED_SETTINGS_ROLES.ADMIN },
  { label: "Member", value: ALLOWED_SETTINGS_ROLES.MEMBER },
];
