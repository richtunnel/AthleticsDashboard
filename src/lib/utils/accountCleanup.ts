const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type AccountCleanupConfig = {
  gracePeriodDays: number;
  reminderWindows: number[];
};

function parsePositiveInteger(value: string | undefined, defaultValue: number, minValue = 1) {
  const parsed = Number.parseInt((value ?? "").trim(), 10);

  if (!Number.isFinite(parsed) || Number.isNaN(parsed)) {
    return defaultValue;
  }

  return Math.max(parsed, minValue);
}

function parseReminderWindows(value: string | undefined, defaults: number[]) {
  const pieces = (value ?? "").split(",");
  const parsed = pieces
    .map((piece) => Number.parseInt(piece.trim(), 10))
    .filter((num) => Number.isFinite(num) && !Number.isNaN(num) && num >= 0);

  const unique = Array.from(new Set(parsed.length ? parsed : defaults));
  unique.sort((a, b) => a - b);

  return unique;
}

export function getAccountCleanupConfig(): AccountCleanupConfig {
  const gracePeriodDays = parsePositiveInteger(process.env.ACCOUNT_DELETION_GRACE_DAYS, 14);
  const reminderWindows = parseReminderWindows(process.env.ACCOUNT_DELETION_REMINDER_DAYS, [7, 1]);

  return {
    gracePeriodDays,
    reminderWindows,
  };
}

export function calculateDeletionDeadline(cancellationDate: Date, gracePeriodOverride?: number) {
  const graceDays = gracePeriodOverride ?? getAccountCleanupConfig().gracePeriodDays;

  return new Date(cancellationDate.getTime() + graceDays * DAY_IN_MS);
}

export { DAY_IN_MS };
