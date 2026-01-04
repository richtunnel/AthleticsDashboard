export const ALLOWED_SETTINGS_ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ATHLETIC_DIRECTOR: "ATHLETIC_DIRECTOR",
  ASSISTANT_AD: "ASSISTANT_AD",
  COACH: "COACH",
  STAFF: "STAFF",
  VENDOR_READ_ONLY: "VENDOR_READ_ONLY",
} as const;

export type AllowedSettingsRole = (typeof ALLOWED_SETTINGS_ROLES)[keyof typeof ALLOWED_SETTINGS_ROLES];

export const ROLE_OPTIONS = [
  { label: "Super Admin", value: ALLOWED_SETTINGS_ROLES.SUPER_ADMIN },
  { label: "Athletic Director", value: ALLOWED_SETTINGS_ROLES.ATHLETIC_DIRECTOR },
  { label: "Assistant AD", value: ALLOWED_SETTINGS_ROLES.ASSISTANT_AD },
  { label: "Coach", value: ALLOWED_SETTINGS_ROLES.COACH },
  { label: "Staff", value: ALLOWED_SETTINGS_ROLES.STAFF },
  { label: "Vendor (Read Only)", value: ALLOWED_SETTINGS_ROLES.VENDOR_READ_ONLY },
];
