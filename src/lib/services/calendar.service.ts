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
  private parseLeagueTokens(sportName: string, sportLevel: string) {
    const GENDER_WORDS = ["boys", "girls", "men", "women", "male", "female"];
    const LEVEL_ALIASES: Record<string, string[]> = {
      varsity:         ["varsity", "var"],
      jv:              ["jv", "j.v.", "junior varsity", "jr varsity", "jr. varsity", "junior v"],
      freshman:        ["freshman", "frosh", "fresh"],
      "middle school": ["middle school", "ms", "middle"],
    };

    const nameLower  = sportName.toLowerCase();
    const levelLower = sportLevel.toLowerCase();

    // Gender — look for it in the sport name string
    const gender = GENDER_WORDS.find((g) => nameLower.includes(g)) ?? null;

    // Core sport keyword — strip gender prefix/suffix, keep meaningful word(s)
    let sportCore = nameLower;
    if (gender) sportCore = sportCore.replace(gender, "").trim();
    sportCore = sportCore.trim(); // e.g. "basketball", "flag football", "cross country"

    // Level — expand the level value into all aliases so "VARSITY" matches "varsity" in text
    const matchedLevel = Object.entries(LEVEL_ALIASES).find(([key, aliases]) =>
      levelLower === key || aliases.some((a) => levelLower.includes(a))
    );
    const levelTokens = matchedLevel
      ? matchedLevel[1]
      : [levelLower]; // fall back to the raw value

    return { gender, sportCore, levelTokens };
  }

  /**
   * Expand common sport/level abbreviations so that a custom-field value like
   * "GV Basketball" also contributes "girls varsity basketball" to the search
   * text, enabling it to match a parent subscribed to "Girls Basketball / VARSITY".
   *
   * Returns a lowercased string with abbreviations replaced; if nothing changed
   * the return value equals `text.toLowerCase()`.
   */
  private expandAbbreviations(text: string): string {
    const ABBR_MAP: [RegExp, string][] = [
      [/\bgv\b/g,  "girls varsity"],
      [/\bbv\b/g,  "boys varsity"],
      [/\bgjv\b/g, "girls junior varsity"],
      [/\bbjv\b/g, "boys junior varsity"],
      [/\bmv\b/g,  "mens varsity"],
      [/\bwv\b/g,  "womens varsity"],
      [/\bmsb\b/g, "middle school boys"],
      [/\bmsg\b/g, "middle school girls"],
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
  /** Public so trigger services can check matches without re-implementing logic. */
  gameMatchesLeague(
    game: any,
    sportName: string,
    sportLevel: string
  ): boolean {
    const { gender, sportCore, levelTokens } = this.parseLeagueTokens(sportName, sportLevel);
    const text = this.buildGameSearchText(game);

    // 1. Level must be present
    if (!levelTokens.some((t) => text.includes(t))) return false;

    // 2. Gender must be present (if specified)
    if (gender && !text.includes(gender)) return false;

    // 3. Sport core must be present (if we have a meaningful keyword)
    if (sportCore && sportCore.length > 2) {
      // Multi-word sports like "cross country" — try each word
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
    // Check if calendar is connected
    const isConnected = await this.isCalendarConnected(userId);
    if (!isConnected) {
      throw new Error("Google Calendar not connected");
    }

    // ── Strategy 1: match via homeTeam DB relations (fast, index-backed) ──
    // Handle sportLevel that might already encode gender (e.g. "VARSITY MALE")
    const levelParts = sportLevel.split(" ");
    const baseLevel  = levelParts[0];
    const gender     = levelParts.length > 1 ? levelParts[1] : null;

    const homeTeamWhere: any = {
      organizationId,
      sport: { name: { equals: sportName, mode: "insensitive" } },
      level: { equals: baseLevel, mode: "insensitive" },
    };
    if (gender) {
      homeTeamWhere.gender = { equals: gender, mode: "insensitive" };
    }

    let games = await prisma.game.findMany({
      where: { homeTeam: homeTeamWhere },
      include: { homeTeam: { include: { sport: true, organization: true } }, opponent: true, awayTeam: true, venue: true },
    });

    // ── Strategy 2: keyword scan across all custom-field columns ──
    // Handles spreadsheet imports where sport/level/gender are embedded in a
    // single column (e.g. "Team = Tigers Boys Varsity") rather than in the
    // normalised DB relations.
    if (games.length === 0) {
      console.log(
        `[CalendarSync] Relation query found 0 games for "${sportName} ${sportLevel}" — ` +
          `falling back to keyword scan of custom fields`
      );

      const allOrgGames = await prisma.game.findMany({
        where: { homeTeam: { organizationId } },
        include: { homeTeam: { include: { sport: true, organization: true } }, opponent: true, awayTeam: true, venue: true },
      });

      games = allOrgGames.filter((g) =>
        this.gameMatchesLeague(g, sportName, sportLevel)
      );

      console.log(
        `[CalendarSync] Keyword scan matched ${games.length} game(s) for "${sportName} ${sportLevel}"`
      );
    }

    // Persist the CalendarGroupMapping once (not per-game) so future trigger
    // syncs can also resolve the correct target calendar for this parent.
    if (games.length > 0) {
      await prisma.calendarGroupMapping.upsert({
        where: {
          userId_columnName_columnValue: {
            userId,
            columnName: "Sport & Level",
            columnValue: `${sportName} ${sportLevel}`,
          },
        },
        update: {
          googleCalendarId: targetGoogleCalendarId,
          googleCalendarName: "Parent Sync",
        },
        create: {
          userId,
          columnName: "Sport & Level",
          columnValue: `${sportName} ${sportLevel}`,
          googleCalendarId: targetGoogleCalendarId,
          googleCalendarName: "Parent Sync",
        },
      });
    }

    const results = [];
    for (const game of games) {
      try {
        // Pass targetGoogleCalendarId directly so syncGameToCalendar doesn't have
        // to reverse-engineer it from game fields via resolveCalendarIdForGame.
        // For CSV-imported games the sport/level columns live inside customFields,
        // not in homeTeam.sport.name / homeTeam.level, so resolveCalendarIdForGame
        // would fall back to "primary" and write to the wrong calendar.
        const result = await this.syncGameToCalendar(game.id, userId, targetGoogleCalendarId);
        results.push({ id: game.id, ok: true, result });
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : "Unknown error";
        console.error(`[CalendarSync] Failed to sync game ${game.id}:`, errorMsg);
        results.push({
          id: game.id,
          ok: false,
          error: errorMsg,
        });
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

      // Parse 24-hour time stored as "HH:MM" in the database.
      let hours = 12;
      let minutes = 0;

      if (game.time && typeof game.time === "string" && game.time.trim()) {
        const timeParts = game.time.trim().split(":");
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

        if (!updateResponse) {
          response = await calendar.events.insert({ calendarId: targetCalendarId, requestBody: event });
        } else {
          response = updateResponse;
        }
      } else {
        response = await calendar.events.insert({ calendarId: targetCalendarId, requestBody: event });
      }

      // Update game and tracker in a transaction
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
