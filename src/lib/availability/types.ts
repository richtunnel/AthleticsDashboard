export interface TeamSpec {
  sport?: string;
  gender?: string;
  level?: string;
}

export interface DateRangeSpec {
  start?: string;
  end?: string;
  month?: string;
  months?: string[];
  weekOfMonth?: number;
  year?: number;
}

export interface AvailabilityQuery {
  targetTeams: TeamSpec[];
  excludeTeams: TeamSpec[];
  dateRange?: DateRangeSpec;
  /**
   * Inclusion filter — when non-empty, ONLY dates on these weekdays are returned.
   * 0 = Sunday … 6 = Saturday.
   * Takes precedence over excludeDays when both are present.
   */
  weekdaysToInclude?: number[];
  excludeDays?: number[];
  minSpacing?: number;
  maxResults?: number;
  interpretation?: string;
  quotaExceeded?: boolean;
}

export type ParseMethod =
  | "ai"
  | "fallback"
  | "fallback-quota"
  | "fallback-timeout"
  | "fallback-invalid";

export interface ParseResult {
  query: AvailabilityQuery;
  method: ParseMethod;
  latencyMs: number;
  rawAIResponse?: string;
}

export interface GameRow {
  date?: string | Date | null;
  sport?: string | null;
  level?: string | null;
  gender?: string | null;
  team?: string | null;
  description?: string | null;
  title?: string | null;
  [key: string]: any;
}
