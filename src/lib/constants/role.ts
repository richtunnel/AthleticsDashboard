export const ALLOWED_SETTINGS_ROLES = {
  ATHLETIC_DIRECTOR: "ATHLETIC_DIRECTOR",
  ASSISTANT_AD: "ASSISTANT_AD",
  COACH: "COACH",
  STAFF: "STAFF",
} as const;

export type AllowedSettingsRole = (typeof ALLOWED_SETTINGS_ROLES)[keyof typeof ALLOWED_SETTINGS_ROLES];

export const ROLE_OPTIONS = [
  { label: "Athletic Director", value: ALLOWED_SETTINGS_ROLES.ATHLETIC_DIRECTOR },
  { label: "Assistant AD", value: ALLOWED_SETTINGS_ROLES.ASSISTANT_AD },
  { label: "Coach", value: ALLOWED_SETTINGS_ROLES.COACH },
  { label: "Staff", value: ALLOWED_SETTINGS_ROLES.STAFF },
];
