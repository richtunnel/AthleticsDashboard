/**
 * Stable IDs for every onboarding TipBubble in the AD dashboard.
 *
 * Adding a new tip? Append a new constant here. The string value is the key
 * persisted in `User.dismissedTips`, so renaming an existing value will
 * cause that tip to re-appear for every user (because their dismissal flag
 * no longer matches). Treat these as a permanent contract.
 */
export const TIP_IDS = {
  GAMES_IMPORT: "games.import.csv",
  OVERVIEW_DROPZONE: "overview.dropzone.intro",
  EMAIL_GROUP_NAME: "email.group.create",
  CALENDAR_CONNECT: "calendar.connect.intro",
  EMAIL_LOGS: "emails.logs.intro",
  POSTS_TAB: "posts.tab.intro",
  ANNOUNCEMENTS_TAB: "posts.announcements.intro",
  PARENTS_SYNC_REQUESTS: "parents.sync.requests",
  PARENTS_CONNECTED: "parents.connected.list",
  PARENTS_PORTAL_SETUP: "parents.portal.setup",
  SETTINGS_OTHER: "settings.other.intro",
  AI_TRAVEL_TIMES: "ai.travel.arrival",

  // ── Community tabs ───────────────────────────────────────────────────────
  POST_SCHEDULE_TAB: "community.post.schedule.intro",
  GAME_REQUESTS_TAB: "community.game.requests.intro",

  // ── Schedule Exchange ────────────────────────────────────────────────────
  SCHEDULE_CHECK_AVAILABILITY: "schedule.check.availability",

  // ── Parent dashboard tips ────────────────────────────────────────────────
  PARENT_UPCOMING_SCHEDULE: "parent.upcoming.schedule",
  PARENT_ADD_CHILD: "parent.add.child",
  PARENT_SYNC_TO_CALENDAR: "parent.sync.calendar",
  PARENT_FEED: "parent.feed.intro",
  PARENT_ANNOUNCEMENTS: "parent.announcements.intro",
  PARENT_CHAT: "parent.chat.intro",
} as const;

export type TipId = (typeof TIP_IDS)[keyof typeof TIP_IDS];
