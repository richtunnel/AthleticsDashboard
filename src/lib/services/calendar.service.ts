import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { prisma } from "../database/prisma";
import { createGoogleOAuth2Client } from "../google/auth";
import { calendarSyncTrackerService } from "./calendar-sync-tracker.service";
import { jobQueueService } from "./job-queue.service";
import { JobType } from "@prisma/client";

const CALENDAR_EVENT_STATUS_SCHEDULED: calendar_v3.Schema$Event["status"] = "confirmed";

export interface UpcomingCalendarEvent {
  id: string;
  summary: string;
  start: string;
  end: string | null;
  isAllDay: boolean;
  location?: string | null;
  opponent?: string | null;
  description?: string | null;
  htmlLink?: string | null;
}

export interface CalendarSyncProgress {
  total: number;
  synced: number;
  failed: number;
  skipped: number;
  errors: string[];
}

export interface CalendarSyncResult {
  success: boolean;
  jobId?: string;
  progress?: CalendarSyncProgress;
  message?: string;
}

export interface CalendarSyncJobPayload {
  userId: string;
  organizationId: string;
  jobId: string;
  gameIds?: string[];
  sportFilter?: { name: string; level: string; gender?: string };
  totalGames?: number;
  currentIndex?: number;
  results?: {
    synced: number;
    failed: number;
    skipped: number;
  };
  errors?: string[];
}

//Google Calendar Sync
export class CalendarService {
  /**
   * Enqueue a calendar sync job and return immediately with job ID
   * For polling-based progress tracking
   */
  async enqueueCalendarSync(
    userId: string,
    organizationId: string,
    options?: {
      sportFilter?: { name: string; level: string; gender?: string };
      gameIds?: string[];
    }
  ): Promise<{ jobId: string }> {
    // 1. Create BackgroundJob row for progress tracking + audit
    const job = await jobQueueService.enqueue({
      type: JobType.CALENDAR_SYNC,
      payload: {
        userId,
        organizationId,
        sportFilter: options?.sportFilter,
        gameIds: options?.gameIds,
      },
      userId,
      organizationId,
      maxAttempts: 3,
    });

    // 2. Dispatch to BullMQ for instant pickup by the worker
    const { calendarSyncQueue } = await import("../queue/queues");
    await calendarSyncQueue.add("sync", {
      userId,
      organizationId,
      backgroundJobId: job.id,
    });

    return { jobId: job.id };
  }

  /**
   * Get sync progress for a specific job
   */
  async getSyncProgress(jobId: string): Promise<CalendarSyncProgress | null> {
    const job = await jobQueueService.getJob(jobId);
    if (!job) return null;

    return job.progress as CalendarSyncProgress | undefined || {
      total: job.result?.totalGames || 0,
      synced: job.result?.synced || 0,
      failed: job.result?.failed || 0,
      skipped: job.result?.skipped || 0,
      errors: job.result?.errors || [],
    };
  }
  private async isCalendarConnected(userId: string): Promise<boolean> {
    const [account, userTokens] = await Promise.all([
      prisma.account.findFirst({
        where: { userId, provider: "google" },
        select: { scope: true, refresh_token: true, access_token: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          googleCalendarRefreshToken: true,
          googleCalendarAccessToken: true,
        },
      }),
    ]);

    const hasAccountTokens = !!(account?.refresh_token || account?.access_token);
    const hasLegacyTokens = !!(
      userTokens?.googleCalendarRefreshToken || userTokens?.googleCalendarAccessToken
    );
    const hasCalendarScopeViaAccount = account?.scope
      ? account.scope.split(" ").some((s) => s.includes("calendar"))
      : false;

    return (hasAccountTokens || hasLegacyTokens) && (hasCalendarScopeViaAccount || hasLegacyTokens);
  }

  private async getCalendarClient(userId: string) {
    const [account, userTokens] = await Promise.all([
      prisma.account.findFirst({
        where: {
          userId,
          provider: "google",
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          googleCalendarRefreshToken: true,
          googleCalendarAccessToken: true,
          calendarTokenExpiry: true,
        },
      }),
    ]);

    const refreshToken = account?.refresh_token ?? userTokens?.googleCalendarRefreshToken ?? undefined;
    let accessToken = account?.access_token ?? userTokens?.googleCalendarAccessToken ?? undefined;
    const expiryMillis = account?.expires_at ? account.expires_at * 1000 : userTokens?.calendarTokenExpiry?.getTime();

    if (!refreshToken && !accessToken) {
      throw new Error("Google account not connected");
    }

    const oauth2Client = createGoogleOAuth2Client();

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    const tokenExpired = expiryMillis !== undefined && expiryMillis < Date.now() - 60 * 1000;

    if ((tokenExpired || !accessToken) && refreshToken) {
      const { credentials } = await oauth2Client.refreshAccessToken();

      accessToken = credentials.access_token ?? accessToken;
      const updatedRefreshToken = credentials.refresh_token ?? refreshToken;
      const updatedExpiry = credentials.expiry_date ?? null;

      if (account) {
        const accountUpdateData: Record<string, any> = {};
        if (accessToken) {
          accountUpdateData.access_token = accessToken;
        }
        if (updatedRefreshToken && updatedRefreshToken !== account.refresh_token) {
          accountUpdateData.refresh_token = updatedRefreshToken;
        }
        if (updatedExpiry !== null) {
          accountUpdateData.expires_at = Math.floor(updatedExpiry / 1000);
        } else if (account.expires_at !== null && account.expires_at !== undefined) {
          accountUpdateData.expires_at = null;
        }

        if (Object.keys(accountUpdateData).length > 0) {
          await prisma.account.update({
            where: { id: account.id },
            data: accountUpdateData,
          });
        }
      }

      const userUpdateData: Record<string, any> = {};
      if (accessToken) {
        userUpdateData.googleCalendarAccessToken = accessToken;
      }
      if (updatedRefreshToken) {
        userUpdateData.googleCalendarRefreshToken = updatedRefreshToken;
      }
      if (updatedExpiry !== null) {
        userUpdateData.calendarTokenExpiry = new Date(updatedExpiry);
      } else if (userTokens?.calendarTokenExpiry) {
        userUpdateData.calendarTokenExpiry = null;
      }

      if (Object.keys(userUpdateData).length > 0) {
        await prisma.user.update({
          where: { id: userId },
          data: userUpdateData,
        });
      }

      oauth2Client.setCredentials({
        access_token: accessToken ?? undefined,
        refresh_token: updatedRefreshToken ?? undefined,
      });
    }

    return google.calendar({ version: "v3", auth: oauth2Client });
  }

  private normalizeMappingValue(input: string) {
    return input.trim().replace(/\s+/g, " ").toLowerCase();
  }

  private async getCandidateCalendarIds(userId: string): Promise<string[]> {
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
      select: { googleCalendarId: true },
    });

    const ids = new Set<string>(["primary"]);
    for (const m of mappings) {
      if (m.googleCalendarId?.trim()) {
        ids.add(m.googleCalendarId.trim());
      }
    }

    return Array.from(ids);
  }

  /**
   * Determine which calendar to use based on user-defined CalendarGroupMappings.
   * This is case/whitespace-insensitive to avoid mismatches from CSV headers/values.
   */
  private async resolveCalendarIdForGame(game: any, userId: string, calendar: any): Promise<string> {
    const mappings = await prisma.calendarGroupMapping.findMany({
      where: { userId },
    });

    if (!mappings.length) {
      return "primary";
    }

    const mappingIndex = new Map<string, (typeof mappings)[number]>();
    for (const m of mappings) {
      mappingIndex.set(`${this.normalizeMappingValue(m.columnName)}::${this.normalizeMappingValue(m.columnValue)}`, m);
    }

    const valuesToCheck: { columnName: string; value: string }[] = [];

    const addCandidate = (columnName: string, rawValue: unknown) => {
      if (typeof rawValue !== "string") return;
      const value = rawValue.trim();
      if (!value) return;
      valuesToCheck.push({ columnName, value });
    };

    const customFields: Record<string, unknown> =
      game.customFields && typeof game.customFields === "object" && !Array.isArray(game.customFields)
        ? (game.customFields as Record<string, unknown>)
        : {};

    const getCustomField = (fieldNames: string[]): string | undefined => {
      const keys = Object.keys(customFields);
      for (const name of fieldNames) {
        const exact = customFields[name];
        if (typeof exact === "string" && exact.trim()) return exact.trim();

        const foundKey = keys.find((k) => k.toLowerCase() === name.toLowerCase());
        const value = foundKey ? customFields[foundKey] : undefined;
        if (typeof value === "string" && value.trim()) return value.trim();
      }
      return undefined;
    };

    const sport = getCustomField(["Sport"]) || game.homeTeam?.sport?.name?.trim();
    const level = getCustomField(["Level"]) || game.homeTeam?.level?.trim();
    const team = getCustomField(["Team", "Home", "Sports Level", "Team Level"]) || game.homeTeam?.name?.trim();

    if (team) {
      addCandidate("Team", team);
      addCandidate("Sports Level", team);
      addCandidate("Team Level", team);
    }

    if (sport && level) {
      const sportLevel = `${sport} ${level}`.trim();
      addCandidate("Sport & Level", sportLevel);
      addCandidate("Sports Level", sportLevel);
    }

    if (sport) {
      addCandidate("Sport", sport);
    }

    if (level) {
      addCandidate("Level", level);
      addCandidate("Team Level", level);
    }

    for (const [key, value] of Object.entries(customFields)) {
      addCandidate(key, value);
    }

    for (const { columnName, value } of valuesToCheck) {
      const mapping = mappingIndex.get(`${this.normalizeMappingValue(columnName)}::${this.normalizeMappingValue(value)}`);
      if (!mapping) continue;

      try {
        await calendar.calendars.get({ calendarId: mapping.googleCalendarId });
        return mapping.googleCalendarId;
      } catch (error) {
        console.warn(`[Calendar Sync] Calendar ${mapping.googleCalendarId} not found, falling back to primary`);
      }
    }

    return "primary";
  }

  async getUpcomingEvents(userId: string, daysAhead = 3): Promise<UpcomingCalendarEvent[]> {
    try {
      // Check if calendar is connected before proceeding
      const isConnected = await this.isCalendarConnected(userId);
      if (!isConnected) {
        return [];
      }

      const calendar = await this.getCalendarClient(userId);

      const now = new Date();
      const timeMin = now.toISOString();
      const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

      const response = await calendar.events.list({
        calendarId: "primary",
        timeMin,
        timeMax,
        singleEvents: true,
        orderBy: "startTime",
        maxResults: 50,
      });

      const items = response.data.items ?? [];
      const upcomingEvents: UpcomingCalendarEvent[] = [];

      for (const event of items) {
        if (event.status === "cancelled") {
          continue;
        }

        const startDate = this.getEventStartDate(event);

        if (!startDate) {
          continue;
        }

        const details = this.extractDetailsFromDescription(event.description);
        const startValue = event.start?.dateTime ?? event.start?.date ?? startDate.toISOString();
        const endValue = event.end?.dateTime ?? event.end?.date ?? null;

        upcomingEvents.push({
          id: event.id ?? `${startValue}-${event.summary ?? "event"}`,
          summary: event.summary ?? "Untitled Event",
          start: startValue,
          end: endValue,
          isAllDay: Boolean(event.start?.date && !event.start?.dateTime),
          location: event.location ?? details.location ?? null,
          opponent: details.opponent ?? null,
          description: event.description ?? null,
          htmlLink: event.htmlLink ?? null,
        });
      }

      upcomingEvents.sort((a, b) => {
        const aTime = new Date(a.start).getTime();
        const bTime = new Date(b.start).getTime();
        return aTime - bTime;
      });

      return upcomingEvents;
    } catch (error) {
      console.error("[Calendar] Error fetching upcoming events:", error);
      return [];
    }
  }

  private getEventStartDate(event: calendar_v3.Schema$Event): Date | null {
    const rawStart = event.start?.dateTime ?? event.start?.date;

    if (!rawStart) {
      return null;
    }

    const parsed = new Date(rawStart);

    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private extractDetailsFromDescription(description?: string | null): { opponent?: string | null; location?: string | null } {
    if (!description) {
      return {};
    }

    const details: { opponent?: string | null; location?: string | null } = {};

    // Strip HTML tags and split on <br>, \n, or both
    const plain = description.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "");
    const lines = plain.split(/\r?\n/);

    for (const line of lines) {
      const [label, ...rest] = line.split(":");

      if (rest.length === 0) {
        continue;
      }

      const value = rest.join(":").trim();
      const normalizedLabel = label.trim().toLowerCase();

      if (normalizedLabel === "opponent") {
        details.opponent = value || null;
      }

      if (normalizedLabel === "location") {
        details.location = value || null;
      }
    }

    return details;
  }

  /**
   * Async calendar sync with progress updates for background job processing
   */
  async syncAllGames(userId: string, organizationId: string, jobId?: string): Promise<{
    synced: number;
    failed: number;
    skipped: number;
    totalGames: number;
    errors: string[];
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    let games;
    if (user?.role === "PARENT") {
      // For parents, only sync games that match approved sync requests
      const approvedRequests = await prisma.calendarSyncRequest.findMany({
        where: {
          parentUserId: userId,
          schoolId: organizationId,
          status: "APPROVED",
        },
      });

      if (approvedRequests.length === 0) {
        return { synced: 0, failed: 0, skipped: 0, totalGames: 0, errors: [] };
      }

      // Build OR conditions for all approved sport/level combinations
      const orConditions = approvedRequests.map((req) => {
        const levelParts = req.sportLevel.split(" ");
        const baseLevel = levelParts[0];
        const gender = levelParts.length > 1 ? levelParts[1] : null;

        return {
          sport: {
            name: { equals: req.sportName, mode: "insensitive" as const },
          },
          level: { equals: baseLevel, mode: "insensitive" as const },
          ...(gender ? { gender: { equals: gender as any, mode: "insensitive" as const } } : {}),
        };
      });

      games = await prisma.game.findMany({
        where: {
          homeTeam: {
            organizationId,
            OR: orConditions,
          },
        },
        select: { id: true },
      });
    } else {
      // For ADs/Staff, sync all games
      games = await prisma.game.findMany({
        where: {
          homeTeam: {
            organizationId,
          },
        },
        select: { id: true },
      });
    }

    const totalGames = games.length;
    let synced = 0;
    let failed = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Update initial progress
    if (jobId) {
      await jobQueueService.updateProgress(jobId, {
        current: 0,
        total: totalGames,
        message: `Starting sync for ${totalGames} games...`,
      });
    }

    for (let i = 0; i < games.length; i++) {
      const g = games[i];
      try {
        const result = await this.syncGameToCalendar(g.id, userId);
        if (result.skipped) {
          skipped++;
        } else {
          synced++;
        }
      } catch (e) {
        failed++;
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        errors.push(`Game ${g.id}: ${errorMsg}`);
      }

      // Update progress every 10 games
      if (jobId && (i + 1) % 10 === 0) {
        await jobQueueService.updateProgress(jobId, {
          current: i + 1,
          total: totalGames,
          message: `Synced ${synced}, failed ${failed}, skipped ${skipped}`,
        });
      }
    }

    // Final progress update
    if (jobId) {
      await jobQueueService.updateProgress(jobId, {
        current: totalGames,
        total: totalGames,
        message: `Sync complete: ${synced} synced, ${failed} failed, ${skipped} skipped`,
      });
    }

    return { synced, failed, skipped, totalGames, errors };
  }

  /**
   * Legacy sync method for backward compatibility
   */
  async syncAllGamesLegacy(userId: string, organizationId: string) {
    const result = await this.syncAllGames(userId, organizationId);
    return result.synced > 0 || result.failed > 0 || result.skipped > 0
      ? result.synced
      : [];
  }

  // ---------------------------------------------------------------------------
  // League keyword helpers
  // ---------------------------------------------------------------------------

  /**
   * Extract normalised tokens from a sport name + level string.
   *
   * e.g. sportName="Boys Basketball", sportLevel="VARSITY"
   *   → { gender: "boys", sportCore: "basketball", levelTokens: ["varsity"] }
   *
   * e.g. sportName="Soccer", sportLevel="JV"
   *   → { gender: null, sportCore: "soccer", levelTokens: ["jv","junior varsity","jr varsity"] }
   */
  // ─── Gender / Level normalisation tables ────────────────────────────────────

  /**
   * All tokens that unambiguously indicate female athletes.
   * Checked against raw text AND abbreviation-expanded text.
   */
  private static readonly GIRLS_TOKENS = [
    "girls", "girl", "g", "f", "female", "women", "woman", "womens", "w",
  ];

  /**
   * All tokens that unambiguously indicate male athletes.
   */
  private static readonly BOYS_TOKENS = [
    "boys", "boy", "b", "m", "male", "men", "man", "mens",
  ];

  /**
   * Canonical level key → every alias an AD might type (case-insensitive).
   * Add rows here as you encounter new shorthands in real spreadsheets.
   */
  private static readonly LEVEL_ALIASES: Record<string, string[]> = {
    varsity: [
      "varsity", "var", "v", "vars",
    ],
    jv: [
      "jv", "j.v.", "j v", "junior varsity", "jr varsity", "jr. varsity",
      "junior v", "jv varsity",
    ],
    sophomore: [
      "sophomore", "soph", "sophy", "sophs", "10th", "so",
    ],
    freshman: [
      "freshman", "frosh", "fresh", "fr", "9th",
    ],
    "middle school": [
      "middle school", "ms", "middle", "7th", "8th", "jr high", "junior high",
    ],
    "c team": [
      "c team", "c-team", "c squad",
    ],
  };

  /**
   * Normalise a raw gender token from the request (e.g. "F", "female", "Girls")
   * to one of the canonical values used in GIRLS_TOKENS / BOYS_TOKENS.
   */
  static normaliseGender(raw: string): "girls" | "boys" | "mixed" | null {
    const lc = raw.trim().toLowerCase();
    if (CalendarService.GIRLS_TOKENS.includes(lc)) return "girls";
    if (CalendarService.BOYS_TOKENS.includes(lc)) return "boys";
    if (["mixed", "co-ed", "coed", "both", "all"].includes(lc)) return "mixed";
    return null;
  }

  private parseLeagueTokens(sportName: string, sportLevel: string, explicitGender?: string | null) {
    const nameLower  = sportName.toLowerCase();
    const levelLower = sportLevel.toLowerCase();

    // ── Gender ──────────────────────────────────────────────────────────────
    // Prefer the AD-supplied explicit gender; fall back to scanning sportName.
    let gender: string | null = null;
    if (explicitGender) {
      gender = CalendarService.normaliseGender(explicitGender);
    }
    if (!gender) {
      // Scan sport name for any gender token (longest-match first to avoid
      // "women" matching "men" inside it)
      const sortedGirls = [...CalendarService.GIRLS_TOKENS].sort((a, b) => b.length - a.length);
      const sortedBoys  = [...CalendarService.BOYS_TOKENS].sort((a, b) => b.length - a.length);
      if (sortedGirls.some((g) => new RegExp(`\\b${g}\\b`).test(nameLower))) {
        gender = "girls";
      } else if (sortedBoys.some((b) => new RegExp(`\\b${b}\\b`).test(nameLower))) {
        gender = "boys";
      }
    }

    // ── Sport core ──────────────────────────────────────────────────────────
    // Strip gender tokens so "Boys Basketball" → "basketball"
    let sportCore = nameLower;
    const allGenderTokens = [...CalendarService.GIRLS_TOKENS, ...CalendarService.BOYS_TOKENS];
    for (const t of allGenderTokens) {
      sportCore = sportCore.replace(new RegExp(`\\b${t}\\b`, "gi"), "").trim();
    }
    sportCore = sportCore.replace(/\s+/g, " ").trim();

    // ── Level aliases ───────────────────────────────────────────────────────
    const matchedLevel = Object.entries(CalendarService.LEVEL_ALIASES).find(
      ([key, aliases]) => levelLower === key || aliases.some((a) => levelLower === a || levelLower.includes(a))
    );
    // Include raw value + ALL aliases so we maximise recall across spreadsheets
    const levelTokens = matchedLevel
      ? Array.from(new Set([matchedLevel[0], ...matchedLevel[1]]))
      : [levelLower];

    return { gender, sportCore, levelTokens };
  }

  /**
   * Expand common sport/gender/level abbreviations that ADs use in spreadsheet
   * column values so keyword matching can find them regardless of notation.
   *
   * Returns the lowercased, abbreviation-expanded form of `text`.
   */
  private expandAbbreviations(text: string): string {
    const ABBR_MAP: [RegExp, string][] = [
      // ── Gender + Level concatenated (GV, BJV, …) ────────────────────────
      [/\bgv\b/gi,   "girls varsity"],
      [/\bbv\b/gi,   "boys varsity"],
      [/\bwv\b/gi,   "womens varsity"],
      [/\bmv\b/gi,   "mens varsity"],
      [/\bgjv\b/gi,  "girls junior varsity"],
      [/\bbjv\b/gi,  "boys junior varsity"],
      [/\bgsoph\b/gi,"girls sophomore"],
      [/\bbsoph\b/gi,"boys sophomore"],
      [/\bgfr\b/gi,  "girls freshman"],
      [/\bbfr\b/gi,  "boys freshman"],
      [/\bmsb\b/gi,  "middle school boys"],
      [/\bmsg\b/gi,  "middle school girls"],

      // ── Space-separated: "G V", "B JV", "W Varsity", etc. ──────────────
      [/\bg\s+v\b/gi,   "girls varsity"],
      [/\bb\s+v\b/gi,   "boys varsity"],
      [/\bw\s+v\b/gi,   "womens varsity"],
      [/\bm\s+v\b/gi,   "mens varsity"],
      [/\bg\s+jv\b/gi,  "girls junior varsity"],
      [/\bb\s+jv\b/gi,  "boys junior varsity"],
      [/\bf\s+v\b/gi,   "female varsity"],
      [/\bf\s+jv\b/gi,  "female junior varsity"],

      // ── Standalone gender abbreviations → canonical form ────────────────
      // Only expand when clearly standalone so we don't corrupt sport names.
      [/\bwomens\b/gi, "girls"],
      [/\bwomen\b/gi,  "girls"],
      [/\bfemale\b/gi, "girls"],
      [/\bmens\b/gi,   "boys"],
      [/\bmale\b/gi,   "boys"],

      // ── Level abbreviations ──────────────────────────────────────────────
      [/\bjr\.?\s*varsity\b/gi, "junior varsity"],
      [/\bjr\.?\s*var\b/gi,     "junior varsity"],
      [/\bj\.?v\.?\b/gi,        "jv"],
      [/\bvars\b/gi,             "varsity"],
      [/\bsoph\b/gi,             "sophomore"],
      [/\bfrosh\b/gi,            "freshman"],
      [/\bfr\b/gi,               "freshman"],
    ];

    let result = text.toLowerCase();
    for (const [re, expansion] of ABBR_MAP) {
      result = result.replace(re, expansion);
    }
    return result;
  }

  /**
   * Collect all searchable text for a game into one lowercase string.
   * Scans homeTeam relations AND every custom-field value — this handles
   * spreadsheet columns like "Team = Tigers Boys Varsity" where gender and
   * level are embedded in a single column.
   *
   * Custom-field values are also run through expandAbbreviations() so that
   * abbreviated values like "GV Basketball" expand to include "girls varsity
   * basketball", enabling keyword matching against parent sync requests.
   */
  private buildGameSearchText(game: any): string {
    const parts: string[] = [];

    // Structured DB fields
    if (game.homeTeam?.sport?.name) parts.push(game.homeTeam.sport.name);
    if (game.homeTeam?.level)       parts.push(game.homeTeam.level);
    if (game.homeTeam?.gender)      parts.push(game.homeTeam.gender);
    if (game.homeTeam?.name)        parts.push(game.homeTeam.name);
    if (game.awayTeam?.name)        parts.push(game.awayTeam.name);

    // All custom-field values from the spreadsheet import
    const cf = game.customFields;
    if (cf && typeof cf === "object") {
      for (const v of Object.values(cf)) {
        const str = typeof v === "string" ? v : v != null ? String(v) : null;
        if (str !== null) {
          parts.push(str);
          // Also include the abbreviation-expanded form — "GV Basketball"
          // becomes "girls varsity basketball" so it matches sport/level tokens
          const expanded = this.expandAbbreviations(str);
          if (expanded !== str.toLowerCase()) parts.push(expanded);
        }
      }
    }

    return parts.join(" ").toLowerCase();
  }

  /**
   * Returns true if the game's combined text matches the given sport + level.
   *
   * Matching rules (all must pass):
   *  1. Level   — at least one level alias found anywhere in game text
   *  2. Gender  — if gender is encoded in sportName, it must appear in game text
   *  3. Sport   — the core sport word(s) must appear somewhere (skipped only
   *               when the sport name is a single-word catch-all that might
   *               produce false positives — we still require it)
   */
  /**
   * Returns true if the game's combined text matches the given sport + level.
   *
   * @param explicitGender  When the AD has explicitly set a gender on the
   *   CalendarSyncRequest, pass it here so it overrides the gender embedded
   *   in sportName. E.g. "g", "girls", "F", "female" all normalise to "girls".
   */
  gameMatchesLeague(
    game: any,
    sportName: string,
    sportLevel: string,
    explicitGender?: string | null
  ): boolean {
    const { gender, sportCore, levelTokens } = this.parseLeagueTokens(
      sportName,
      sportLevel,
      explicitGender
    );
    const text = this.buildGameSearchText(game);

    // 1. Level must be present (any alias)
    if (!levelTokens.some((t) => text.includes(t))) return false;

    // 2. Gender must be present — check both the canonical word AND single-letter
    //    abbreviations that ADs commonly use (e.g. "G Basketball", "B Soccer")
    if (gender) {
      const genderTokens =
        gender === "girls"
          ? CalendarService.GIRLS_TOKENS
          : CalendarService.BOYS_TOKENS;
      // Require at least one gender token to appear as a word boundary in text
      const hasGender = genderTokens.some((g) =>
        new RegExp(`(?<![a-z])${g}(?![a-z])`, "i").test(text)
      );
      if (!hasGender) return false;
    }

    // 3. Sport core keyword(s) must appear in text
    if (sportCore && sportCore.length > 2) {
      const sportWords = sportCore.split(" ").filter((w) => w.length > 2);
      if (sportWords.length > 0 && !sportWords.some((w) => text.includes(w))) return false;
    }

    return true;
  }

  // ---------------------------------------------------------------------------

  async syncGamesForSportLevel(
    userId: string,
    organizationId: string,
    sportName: string,
    sportLevel: string,
    targetGoogleCalendarId: string
  ) {
    const GAME_LIMIT = 15;
    // Process up to 5 games concurrently — safe under 100 simultaneous callers
    // because each batch hits the DB once and Google Calendar once per game.
    const CONCURRENCY = 5;
    const now = new Date();

    if (!await this.isCalendarConnected(userId)) {
      throw new Error("Google Calendar not connected");
    }

    const gameInclude = {
      homeTeam: { include: { sport: true, organization: true } },
      opponent: true,
      awayTeam: true,
      venue: true,
    } as const;

    // ── Strategy 1: normalized DB relations (fast, index-backed) ──
    // Only future games, sorted soonest-first, hard-capped at GAME_LIMIT.
    const levelParts = sportLevel.split(" ");
    const baseLevel     = levelParts[0];
    const encodedGender = levelParts.length > 1 ? levelParts[1] : null;

    const homeTeamWhere: any = {
      organizationId,
      sport: { name: { equals: sportName, mode: "insensitive" } },
      level: { equals: baseLevel, mode: "insensitive" },
    };
    if (encodedGender) {
      homeTeamWhere.gender = { equals: encodedGender, mode: "insensitive" };
    }

    let games = await prisma.game.findMany({
      where: { homeTeam: homeTeamWhere, date: { gte: now } },
      orderBy: { date: "asc" },
      take: GAME_LIMIT,
      include: gameInclude,
    });

    // ── Strategy 2: scan customFields columns (spreadsheet imports) ──
    // ADs upload CSV files where sport/level may live in any column with any
    // header name. We load all future org games and scan every cell value in
    // each row for sport + level tokens — order-independent similarity match.
    if (games.length === 0) {
      console.log(
        `[CalendarSync] DB relations found 0 future games for "${sportName} ${sportLevel}" — ` +
          `scanning spreadsheet columns`
      );

      const futurOrgGames = await prisma.game.findMany({
        where: { homeTeam: { organizationId }, date: { gte: now } },
        orderBy: { date: "asc" },
        include: gameInclude,
      });

      games = futurOrgGames
        .filter((g) => this.gameMatchesLeague(g, sportName, sportLevel))
        .slice(0, GAME_LIMIT);

      console.log(
        `[CalendarSync] Column scan matched ${games.length} future game(s) for "${sportName} ${sportLevel}"`
      );
    }

    // Persist CalendarGroupMapping once so future trigger syncs can resolve
    // the correct target calendar without re-running the full match.
    if (games.length > 0) {
      await prisma.calendarGroupMapping.upsert({
        where: {
          userId_columnName_columnValue: {
            userId,
            columnName: "Sport & Level",
            columnValue: `${sportName} ${sportLevel}`,
          },
        },
        update:  { googleCalendarId: targetGoogleCalendarId, googleCalendarName: "Parent Sync" },
        create:  { userId, columnName: "Sport & Level", columnValue: `${sportName} ${sportLevel}`, googleCalendarId: targetGoogleCalendarId, googleCalendarName: "Parent Sync" },
      });
    }

    // Sync with bounded concurrency so 100 simultaneous parents don't exhaust
    // the DB connection pool or Google Calendar API quota.
    const results: { id: string; ok: boolean; result?: any; error?: string }[] = [];
    for (let i = 0; i < games.length; i += CONCURRENCY) {
      const batch = games.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((game) => this.syncGameToCalendar(game.id, userId, targetGoogleCalendarId))
      );
      for (let j = 0; j < batch.length; j++) {
        const r = settled[j];
        if (r.status === "fulfilled") {
          results.push({ id: batch[j].id, ok: r.value.success !== false, result: r.value });
        } else {
          const errorMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error(`[CalendarSync] Failed to sync game ${batch[j].id}:`, errorMsg);
          results.push({ id: batch[j].id, ok: false, error: errorMsg });
        }
      }
    }

    return results;
  }

  async syncGameToCalendar(gameId: string, userId: string, forcedCalendarId?: string) {
    // 1. Acquire an atomic lock to prevent concurrent syncs for the same game
    try {
      const lockAcquired = await prisma.game.updateMany({
        where: {
          id: gameId,
          syncInProgress: false,
        },
        data: {
          syncInProgress: true,
        },
      });

      if (lockAcquired.count === 0) {
        console.log(`[Calendar Sync] Sync already in progress for game ${gameId}, skipping.`);
        return { 
          success: false, 
          skipped: true, 
          message: "A synchronization is already in progress for this game." 
        };
      }
    } catch (lockError) {
      console.error("[Calendar Sync] Lock acquisition error:", lockError);
      return { success: false, error: "Sync lock failed" };
    }

    try {
      // Get user's organizationId (only need this field)
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, organizationId: true, role: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Get the game with its details
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          homeTeam: {
            include: {
              sport: true,
              organization: true, // Get timezone from org
            },
          },
          opponent: true,
          awayTeam: true,
          venue: true,
        },
      });

      if (!game) {
        throw new Error("Game not found");
      }

      // ✅ VALIDATE permissions
      if (user.role === "PARENT") {
        // Parent must have an approved request for this sport/level.
        // We fetch all approved requests first so we can try both strategies
        // without additional round-trips.
        const approvedRequests = await prisma.calendarSyncRequest.findMany({
          where: {
            parentUserId: userId,
            schoolId: game.homeTeam.organizationId,
            status: "APPROVED",
          },
        });

        // Strategy 1: match via DB relations (fast)
        let hasApprovedRequest = approvedRequests.some((req) => {
          if (!game.homeTeam.sport?.name) return false;
          if (req.sportName.toLowerCase() !== game.homeTeam.sport.name.toLowerCase()) return false;

          const levelParts = req.sportLevel.split(" ");
          const baseLevel = levelParts[0];
          const gender = levelParts.length > 1 ? levelParts[1] : null;

          const levelMatches = game.homeTeam.level?.toLowerCase() === baseLevel.toLowerCase();
          const genderMatches = !gender || game.homeTeam.gender?.toLowerCase() === gender.toLowerCase();

          return levelMatches && genderMatches;
        });

        // Strategy 2: keyword fallback for CSV-imported games where sport/level/gender
        // are in customFields rather than normalised DB relations
        if (!hasApprovedRequest) {
          hasApprovedRequest = approvedRequests.some((req) =>
            this.gameMatchesLeague(game, req.sportName, req.sportLevel)
          );
        }

        if (!hasApprovedRequest) {
          throw new Error("Unauthorized: No approved sync request for this sport and level");
        }
      } else {
        // AD/Staff must be in the same organization
        if (game.homeTeam.organizationId !== user.organizationId) {
          throw new Error("Unauthorized: Game does not belong to your organization");
        }
      }

      // Check if this is the user's first synced game (for tracker)
      const isNewSyncUser = await calendarSyncTrackerService.isNewSyncUser(userId);

      // Check if calendar is connected before proceeding
      const isConnected = await this.isCalendarConnected(userId);
      if (!isConnected) {
        return {
          success: false,
          skipped: true,
          message: "Google Calendar not connected",
        };
      }

      // Get calendar client
      const calendar = await this.getCalendarClient(userId);

      // ── Datetime construction ──
      // Use the org's IANA timezone (e.g. "America/New_York") and build a
      // naïve datetime string (no UTC offset suffix) paired with start.timeZone.
      // This mirrors the fix applied in google-calendar-sync.ts and avoids the
      // server's local UTC offset being baked into the datetime string.
      const orgTimezone: string =
        game.homeTeam?.organization?.timezone || "America/New_York";

      const pad = (n: number) => n.toString().padStart(2, "0");

      // Extract the calendar date using explicit UTC components so the server's
      // local timezone never shifts the date by a day.
      const gameDate = game.date instanceof Date ? game.date : new Date(game.date);
      const isoDateOnly = `${gameDate.getUTCFullYear()}-${pad(gameDate.getUTCMonth() + 1)}-${pad(gameDate.getUTCDate())}`;

      // Parse game time — handles both 24-hour "HH:MM" and 12-hour "H:MM AM/PM" formats.
      // Games imported before the CSV normalisation fix (PR #809) may still carry
      // "H:MM AM/PM" strings, so we must parse both formats here.
      let hours = 12;
      let minutes = 0;

      if (game.time && typeof game.time === "string" && game.time.trim()) {
        const timeStr = game.time.trim();

        // Try 12-hour AM/PM format first: "H:MM AM", "H:MM PM", "H:MM:SS AM/PM"
        const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
        if (amPmMatch) {
          let h = parseInt(amPmMatch[1], 10);
          const m = parseInt(amPmMatch[2], 10);
          const period = amPmMatch[3].toUpperCase();
          if (period === "AM" && h === 12) h = 0;   // 12:xx AM → 0:xx
          if (period === "PM" && h !== 12) h += 12; // 1–11 PM → 13–23
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            hours = h;
            minutes = m;
          }
        } else {
          // Fall back to 24-hour "HH:MM" (or "HH:MM:SS")
          const timeParts = timeStr.split(":");
          if (timeParts.length >= 2) {
            const parsedHours = parseInt(timeParts[0], 10);
            const parsedMinutes = parseInt(timeParts[1], 10);
            if (
              !isNaN(parsedHours) && !isNaN(parsedMinutes) &&
              parsedHours >= 0 && parsedHours <= 23 &&
              parsedMinutes >= 0 && parsedMinutes <= 59
            ) {
              hours = parsedHours;
              minutes = parsedMinutes;
            }
          }
        }
      }

      // Naïve datetime strings — Google Calendar interprets them in start.timeZone.
      const naiveStart = `${isoDateOnly}T${pad(hours)}:${pad(minutes)}:00`;
      const endHours   = hours + 2;
      const naiveEnd   = endHours < 24
        ? `${isoDateOnly}T${pad(endHours)}:${pad(minutes)}:00`
        : `${isoDateOnly}T23:59:00`; // cap at midnight if event pushes past day

      const startDateTime = naiveStart;
      const endDateTime   = naiveEnd;

      let location = "TBD";
      if (game.isHome) {
        location = "Home";
      } else if (game.venue) {
        const locationParts = [game.venue.name, game.venue.address, game.venue.city, game.venue.state].filter(part => part && part.trim()); 
        location = locationParts.length > 0 ? locationParts.join(", ") : "TBD";
      }

      const event: calendar_v3.Schema$Event = {
        status: CALENDAR_EVENT_STATUS_SCHEDULED,
        summary: this.buildEventSummary(game),
        description: this.buildEventDescription(game),
        location,
        start: { dateTime: startDateTime, timeZone: orgTimezone },
        end: { dateTime: endDateTime, timeZone: orgTimezone },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "email", minutes: 24 * 60 },
            { method: "notification", minutes: 60 },
          ],
        },
      };

      // If the caller already knows the target calendar (e.g. syncGamesForSportLevel),
      // skip resolveCalendarIdForGame entirely — it can't reverse-engineer the correct
      // calendar ID from CSV-imported games where sport/level live in customFields.
      const targetCalendarId = forcedCalendarId ?? await this.resolveCalendarIdForGame(game, userId, calendar);

      let response: any;

      if (user.role === "PARENT") {
        // ── Parent path ──────────────────────────────────────────────────────
        // Parent event IDs are stored in ParentGameCalendarEvent so they NEVER
        // collide with the AD's game.googleCalendarEventId.
        const existing = await prisma.parentGameCalendarEvent.findUnique({
          where: { parentUserId_gameId: { parentUserId: userId, gameId } },
        });

        let updated = false;
        if (existing) {
          // Try to update the existing parent event
          try {
            response = await calendar.events.update({
              calendarId: existing.googleCalendarId,
              eventId: existing.googleCalendarEventId,
              requestBody: event,
            });
            updated = true;
          } catch (err: any) {
            // 404 means the event was deleted from the parent's calendar — fall through to insert
            if ((err?.code ?? err?.status) !== 404) throw err;
          }
        }

        if (!updated) {
          response = await calendar.events.insert({ calendarId: targetCalendarId, requestBody: event });
          // Upsert the per-parent event record
          await prisma.parentGameCalendarEvent.upsert({
            where: { parentUserId_gameId: { parentUserId: userId, gameId } },
            create: {
              parentUserId: userId,
              gameId,
              googleCalendarEventId: response.data.id,
              googleCalendarId: targetCalendarId,
            },
            update: {
              googleCalendarEventId: response.data.id,
              googleCalendarId: targetCalendarId,
            },
          });
        } else {
          // Update the stored calendar/event IDs in case the parent switched calendars
          await prisma.parentGameCalendarEvent.update({
            where: { parentUserId_gameId: { parentUserId: userId, gameId } },
            data: {
              googleCalendarEventId: response.data.id,
              googleCalendarId: existing!.googleCalendarId,
            },
          });
        }
        // Parents never touch game.googleCalendarEventId — that field belongs to the AD.
      } else {
        // ── AD / Staff path ──────────────────────────────────────────────────
        if (game.googleCalendarEventId) {
          const candidateCalendarIds = await this.getCandidateCalendarIds(userId);
          const calendarIdsToTry = [targetCalendarId, ...candidateCalendarIds.filter((id) => id !== targetCalendarId)];

          let updateResponse: any | null = null;
          for (const calendarId of calendarIdsToTry) {
            try {
              updateResponse = await calendar.events.update({
                calendarId,
                eventId: game.googleCalendarEventId,
                requestBody: event,
              });
              break;
            } catch (err: any) {
              if ((err?.code ?? err?.status) === 404) continue;
              throw err;
            }
          }

          response = updateResponse
            ? updateResponse
            : await calendar.events.insert({ calendarId: targetCalendarId, requestBody: event });
        } else {
          response = await calendar.events.insert({ calendarId: targetCalendarId, requestBody: event });
        }

        // Update game record — only for AD syncs
        await prisma.$transaction(async (tx) => {
          await tx.game.update({
            where: { id: gameId },
            data: {
              googleCalendarEventId: response.data.id || null,
              googleCalendarHtmlLink: response.data.htmlLink || null,
              calendarSynced: true,
              lastSyncedAt: new Date(),
            },
          });

          if (isNewSyncUser) {
            const tracker = await tx.googleCalendarSyncTracker.findFirst({ select: { id: true } });
            if (tracker) {
              await tx.googleCalendarSyncTracker.update({ where: { id: tracker.id }, data: { count: { increment: 1 } } });
            } else {
              await tx.googleCalendarSyncTracker.create({ data: { id: "default", count: 1, lastCountedAt: new Date() } });
            }
          }
        });
      }

      return response.data;
    } catch (error: any) {
      console.error("[Calendar Sync] Failed:", error.message);
      throw error;
    } finally {
      try {
        await prisma.game.update({
          where: { id: gameId },
          data: { syncInProgress: false }
        });
      } catch (releaseError) {
        console.error("[Calendar Sync] Error releasing lock:", releaseError);
      }
    }
  }

  async deleteCalendarEvent(userId: string, eventId: string): Promise<boolean> {
    try {
      const isConnected = await this.isCalendarConnected(userId);
      if (!isConnected) return true;

      const calendar = await this.getCalendarClient(userId);
      const calendarIdsToTry = await this.getCandidateCalendarIds(userId);

      for (const calendarId of calendarIdsToTry) {
        try {
          await calendar.events.delete({ calendarId, eventId });
          return true;
        } catch (error: any) {
          const statusCode = error?.code ?? error?.status;
          if (statusCode === 404 || statusCode === 410) continue;
          throw error;
        }
      }
      return true;
    } catch (error: any) {
      console.error(`[Calendar] Failed to delete event ${eventId}:`, error);
      return false;
    }
  }

  async unsyncGame(gameId: string, userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    if (!user) throw new Error("User not found");

    const isConnected = await this.isCalendarConnected(userId);
    if (!isConnected) return { success: false, skipped: true, message: "Google Calendar not connected" };

    const game = await prisma.game.findFirst({
      where: { id: gameId, homeTeam: { organizationId: user.organizationId } },
      select: { id: true, googleCalendarEventId: true },
    });

    if (!game || !game.googleCalendarEventId) throw new Error("Game not found or not synced");

    try {
      const deleted = await this.deleteCalendarEvent(userId, game.googleCalendarEventId);
      if (!deleted) throw new Error("Failed to remove event from Google Calendar");

      await prisma.$transaction(async (tx) => {
        await tx.game.update({
          where: { id: game.id },
          data: { googleCalendarEventId: null, googleCalendarHtmlLink: null, calendarSynced: false },
        });

        const syncedCount = await tx.game.count({ where: { createdById: userId, calendarSynced: true } });
        if (syncedCount === 0) {
          const tracker = await tx.googleCalendarSyncTracker.findFirst({ select: { id: true, count: true } });
          if (tracker && tracker.count > 0) {
            await tx.googleCalendarSyncTracker.update({ where: { id: tracker.id }, data: { count: { decrement: 1 } } });
          }
        }
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to remove from calendar:", error);
      throw error;
    }
  }

  private buildEventSummary(game: any): string {
    const primaryTeamName = this.getPrimaryTeamName(game);
    const opponentName = this.getOpponentTeamName(game);
    const separator = game.isHome ? " vs " : " @ ";
    const sportLevelInfo = this.getSportLevelInfo(game);
    
    let summary = `${primaryTeamName}${separator}${opponentName}`;
    if (sportLevelInfo) summary += ` - ${sportLevelInfo}`;
    return summary;
  }

  private getPrimaryTeamName(game: any): string {
    const customFields = (game.customFields as Record<string, any>) || {};
    const getField = (fieldNames: string[]): string | undefined => {
      for (const name of fieldNames) {
        if (customFields[name]) return customFields[name]?.trim();
        const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
        if (key && customFields[key]) return customFields[key]?.trim();
      }
      return undefined;
    };

    return getField(["Home"]) || getField(["Team"]) || 
           (getField(["Sport"]) && getField(["Level"]) ? `${getField(["Sport"])} ${getField(["Level"])}` : getField(["Sport"])) ||
           getField(["Sports Level", "Team Level"]) ||
           game.homeTeam?.name?.trim() || game.homeTeam?.sport?.name?.trim() || "TBD";
  }

  private getOpponentTeamName(game: any): string {
    const customFields = (game.customFields as Record<string, any>) || {};
    const getField = (fieldNames: string[]): string | undefined => {
      for (const name of fieldNames) {
        if (customFields[name]) return customFields[name]?.trim();
        const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
        if (key && customFields[key]) return customFields[key]?.trim();
      }
      return undefined;
    };

    return getField(["Away"]) || getField(["Opponent"]) || getField(["Enemy", "Visiting Team", "Visitor"]) ||
           game.opponent?.name?.trim() || game.awayTeam?.name?.trim() || "TBD";
  }

  private getSportLevelInfo(game: any): string | null {
    const customFields = (game.customFields as Record<string, any>) || {};
    const getField = (fieldNames: string[]): string | undefined => {
      for (const name of fieldNames) {
        if (customFields[name]) return customFields[name]?.trim();
        const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
        if (key && customFields[key]) return customFields[key]?.trim();
      }
      return undefined;
    };

    const sportLevel = getField(["Sport Level", "Sport/Level", "Sports Level", "Team Level"]);
    if (sportLevel) return sportLevel;
    const tier = getField(["Tier", "Tiers"]);
    if (tier) return tier;

    const sport = getField(["Sport"]);
    const level = getField(["Level"]);
    if (sport && level) return `${sport} ${level}`;
    if (sport) return sport;
    if (level) return level;

    const dbSport = game.homeTeam?.sport?.name?.trim();
    const dbLevel = game.homeTeam?.level?.trim();
    const dbGender = game.homeTeam?.gender;
    if (dbSport && dbLevel) return dbGender ? `${dbSport} ${dbLevel} ${dbGender}` : `${dbSport} ${dbLevel}`;
    if (dbSport) return dbSport;
    if (dbLevel) return dbLevel;
    return null;
  }

  private buildEventDescription(game: any): string {
    const customFields = (game.customFields as Record<string, any>) || {};
    const getField = (fieldNames: string[], defaultValue?: any): string => {
      for (const name of fieldNames) {
        if (customFields[name]) return customFields[name];
        const key = Object.keys(customFields).find(k => k.toLowerCase() === name.toLowerCase());
        if (key && customFields[key]) return customFields[key];
      }
      return defaultValue || "TBD";
    };

    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const sport  = getField(["Sport"],         game.homeTeam?.sport?.name);
    const level  = getField(["Level"],          game.homeTeam?.level);
    const team   = getField(["Team", "Home"],   game.homeTeam?.name);
    const status = getField(["Status"],         game.status);

    // Use HTML <br> tags so Google Calendar renders each item on its own line.
    // Plain-text \n characters are collapsed by Google Calendar's HTML renderer.
    const lines: string[] = [
      `<b>Sport:</b> ${esc(sport)}`,
      `<b>Level:</b> ${esc(level)}`,
      `<b>Team:</b> ${esc(team)}`,
      `<b>Status:</b> ${esc(status)}`,
    ];

    if (game.opponent) {
      lines.push(`<b>Opponent:</b> ${esc(game.opponent.name)}`);
    }

    let description = lines.join("<br>");

    if (game.travelRequired) {
      description += "<br><br><b>Travel Information:</b><br>";
      description += `&bull; Travel Time: ${esc(String(game.estimatedTravelTime || "TBD"))} minutes`;
      if (game.busCount) description += `<br>&bull; Buses: ${esc(String(game.busCount))}`;
      if (game.departureTime) description += `<br>&bull; Departure: ${esc(new Date(game.departureTime).toLocaleTimeString())}`;
    }

    if (game.notes) {
      description += `<br><br><b>Notes:</b> ${esc(String(game.notes))}`;
    }

    return description;
  }
}

export const calendarService = new CalendarService();
