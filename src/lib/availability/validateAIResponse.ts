import { AvailabilityQuery } from "./types";

export function tryParseJSON(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function assertOptionalString(obj: Record<string, unknown>, key: string): void {
  if (obj[key] !== undefined && typeof obj[key] !== "string") {
    throw new Error(`${key} must be a string`);
  }
}

function coerceIntArray(value: unknown, fieldName: string): number[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) throw new Error(`${fieldName} must be an array`);
  return value.map((v, i) => {
    const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      throw new Error(`${fieldName}[${i}] must be an integer between 0 and 6`);
    }
    return n;
  });
}

export function validateAIResponse(raw: unknown): AvailabilityQuery {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Response must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;

  if (!Array.isArray(obj.targetTeams)) {
    throw new Error("targetTeams must be an array");
  }
  if (!Array.isArray(obj.excludeTeams)) {
    obj.excludeTeams = [];
  }

  const targetTeams = (obj.targetTeams as unknown[]).map((t, i) => {
    if (typeof t !== "object" || t === null || Array.isArray(t)) {
      throw new Error(`targetTeams[${i}] must be an object`);
    }
    const team = t as Record<string, unknown>;
    assertOptionalString(team, "sport");
    assertOptionalString(team, "gender");
    assertOptionalString(team, "level");
    return {
      sport: typeof team.sport === "string" ? team.sport : undefined,
      gender: typeof team.gender === "string" ? team.gender : undefined,
      level: typeof team.level === "string" ? team.level : undefined,
    };
  });

  const excludeTeams = (obj.excludeTeams as unknown[]).map((t, i) => {
    if (typeof t !== "object" || t === null || Array.isArray(t)) {
      throw new Error(`excludeTeams[${i}] must be an object`);
    }
    const team = t as Record<string, unknown>;
    return {
      sport: typeof team.sport === "string" ? team.sport : undefined,
      gender: typeof team.gender === "string" ? team.gender : undefined,
      level: typeof team.level === "string" ? team.level : undefined,
    };
  });

  let dateRange: AvailabilityQuery["dateRange"] | undefined;
  if (obj.dateRange !== undefined) {
    if (typeof obj.dateRange !== "object" || obj.dateRange === null || Array.isArray(obj.dateRange)) {
      throw new Error("dateRange must be an object");
    }
    const dr = obj.dateRange as Record<string, unknown>;

    if (dr.start !== undefined) {
      if (typeof dr.start !== "string" || !ISO_DATE_RE.test(dr.start)) {
        throw new Error("dateRange.start must be a YYYY-MM-DD string");
      }
    }
    if (dr.end !== undefined) {
      if (typeof dr.end !== "string" || !ISO_DATE_RE.test(dr.end)) {
        throw new Error("dateRange.end must be a YYYY-MM-DD string");
      }
    }

    let months: string[] | undefined;
    let month: string | undefined;

    if (dr.months !== undefined) {
      if (!Array.isArray(dr.months)) throw new Error("dateRange.months must be an array");
      months = (dr.months as unknown[]).map((m) => String(m).toLowerCase());
    } else if (dr.month !== undefined) {
      month = String(dr.month).toLowerCase();
    }

    const weekOfMonth =
      dr.weekOfMonth !== undefined
        ? (() => {
            const n = Number(dr.weekOfMonth);
            if (!Number.isInteger(n) || n < 1 || n > 5) {
              throw new Error("dateRange.weekOfMonth must be an integer between 1 and 5");
            }
            return n;
          })()
        : undefined;

    const year =
      dr.year !== undefined
        ? (() => {
            const n = Number(dr.year);
            if (!Number.isInteger(n) || n < 2000 || n > 2100) {
              throw new Error("dateRange.year must be an integer between 2000 and 2100");
            }
            return n;
          })()
        : undefined;

    const drBuilt: AvailabilityQuery["dateRange"] = {};
    const drStart = typeof dr.start === "string" ? dr.start : undefined;
    const drEnd = typeof dr.end === "string" ? dr.end : undefined;
    if (drStart) drBuilt.start = drStart;
    if (drEnd) drBuilt.end = drEnd;
    if (month) drBuilt.month = month;
    if (months && months.length > 0) drBuilt.months = months;
    if (weekOfMonth !== undefined) drBuilt.weekOfMonth = weekOfMonth;
    if (year !== undefined) drBuilt.year = year;

    dateRange = Object.keys(drBuilt).length > 0 ? drBuilt : undefined;
  }

  const weekdaysToInclude = coerceIntArray(obj.weekdaysToInclude, "weekdaysToInclude");
  let excludeDays = coerceIntArray(obj.excludeDays, "excludeDays");

  if (weekdaysToInclude && weekdaysToInclude.length > 0 && excludeDays && excludeDays.length > 0) {
    excludeDays = excludeDays.filter((d) => !weekdaysToInclude.includes(d));
    if (excludeDays.length === 0) excludeDays = undefined;
  }

  let minSpacing: number | undefined;
  if (obj.minSpacing !== undefined) {
    const n = Number(obj.minSpacing);
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      throw new Error("minSpacing must be a positive integer between 1 and 30");
    }
    minSpacing = n;
  }

  let maxResults: number | undefined;
  if (obj.maxResults !== undefined) {
    const n = Number(obj.maxResults);
    if (!Number.isInteger(n) || n < 1 || n > 50) {
      throw new Error("maxResults must be an integer between 1 and 50");
    }
    maxResults = n;
  }

  let interpretation: string | undefined;
  if (obj.interpretation !== undefined) {
    if (typeof obj.interpretation !== "string") {
      throw new Error("interpretation must be a string");
    }
    interpretation = obj.interpretation.slice(0, 500);
  }

  const result: AvailabilityQuery = {
    targetTeams,
    excludeTeams,
  };

  if (dateRange) result.dateRange = dateRange;
  if (weekdaysToInclude && weekdaysToInclude.length > 0) result.weekdaysToInclude = weekdaysToInclude;
  if (excludeDays && excludeDays.length > 0) result.excludeDays = excludeDays;
  if (minSpacing !== undefined) result.minSpacing = minSpacing;
  if (maxResults !== undefined) result.maxResults = maxResults;
  if (interpretation !== undefined) result.interpretation = interpretation;

  return result;
}
