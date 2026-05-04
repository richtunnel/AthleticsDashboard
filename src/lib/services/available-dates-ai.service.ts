import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

interface ParsedQuery {
  targetTeams: Array<{
    sport?: string;
    gender?: string;
    level?: string;
  }>;
  excludeTeams: Array<{
    sport?: string;
    gender?: string;
    level?: string;
  }>;
  dateRange?: {
    start?: string;
    end?: string;
    month?: string;
    months?: string[];
  };
  minSpacing?: number;
  maxResults?: number;
  excludeDays?: number[];
  interpretation?: string;
  recommendation?: string;
  quotaExceeded?: boolean; // true when OpenAI returned 429
}

export class AvailableDatesAIService {
  /**
   * Parse natural language query using OpenAI LLM
   */
  async parseQuery(prompt: string): Promise<ParsedQuery> {
    if (!openai) {
      console.log("[Available Dates AI] OpenAI API key not configured. Using fallback parsing for advanced constraints.");
      console.log("[Available Dates AI] Basic team matching will still work via rule-based service.");
      return this.fallbackParse(prompt);
    }

    const systemPrompt = `You are a sports scheduling assistant. Parse natural language queries about finding available dates.

Extract the following information:
1. Target teams (teams to find dates FOR) - include sport, gender, and level if mentioned
2. Exclude teams (teams whose dates should be AVOIDED) - include sport, gender, and level if mentioned
3. Date range constraints (specific months, date ranges)
4. Minimum spacing between dates (e.g., "at least 3 days apart")
5. Days of week to exclude (e.g., "no Sundays", "weekdays only")
6. Maximum number of results
7. interpretation: A human-friendly sentence explaining what you understood from the query (e.g., "Finding available dates for Boys Varsity Basketball in December, avoiding dates when Girls JV Volleyball is playing.")

IMPORTANT: When parsing team information, IGNORE the following words that describe the TYPE of dates being requested (not team characteristics):
- "open", "available", "free", "empty", "clear", "good", "best", "suitable"
- These words describe what KIND of dates the user wants, not which team they are

Common abbreviations:
- B/Boys, G/Girls for gender
- V/Varsity, JV/Junior Varsity, Frosh/Freshman for level
- BB/Basketball, FB/Football, VB/Volleyball, SB/Softball, etc.

Examples:
- "B V Basketball" → Boys Varsity Basketball
- "GV soccer" → Girls Varsity Soccer
- "not on the same days as boys JV basketball" → exclude Boys Junior Varsity Basketball dates
- "find open dates in December for boys varsity basketball" → targetTeams: Boys Varsity Basketball, dateRange: {month: "December"}
- "find available dates for girls varsity volleyball" → targetTeams: Girls Varsity Volleyball
- "find open dates in september, july and august for boys varsity basketball" → targetTeams: Boys Varsity Basketball, dateRange: {months: ["September", "July", "August"]}

IMPORTANT: When multiple months are mentioned (e.g., "september, july and august"), use the "months" array field, not "month":
- Single month: use "month" field → {"month": "December"}
- Multiple months: use "months" array field → {"months": ["September", "July", "August"]}

Return JSON format:
{
  "targetTeams": [{"sport": "Basketball", "gender": "Boys", "level": "Varsity"}],
  "excludeTeams": [{"sport": "Basketball", "gender": "Boys", "level": "Junior Varsity"}],
  "dateRange": {"months": ["September", "July", "August"]},
  "minSpacing": 3,
  "excludeDays": [0, 6],
  "maxResults": 10,
  "interpretation": "Finding available dates for Boys Varsity Basketball in December with at least 3 days between games, excluding weekends."
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");
      return this.normalizeParsedQuery(result);
    } catch (error: any) {
      const isQuota = error?.status === 429 || error?.code === "insufficient_quota";
      if (isQuota) {
        console.warn("[Available Dates AI] OpenAI quota exceeded — using fallback parsing.");
      } else {
        console.error("AI query parsing failed:", error);
      }
      return this.fallbackParse(prompt, isQuota);
    }
  }

  /**
   * Robust fallback parser — works without OpenAI.
   * Extracts months (full names + abbreviations), spacing, day-of-week
   * exclusions, and team info (sport / gender / level) from free-text prompts.
   */
  private fallbackParse(prompt: string, quotaExceeded = false): ParsedQuery {
    const lower = prompt.toLowerCase();

    // ── months ────────────────────────────────────────────────────────────────
    const MONTH_CANONICAL: Record<string, string> = {
      jan: "january", january: "january",
      feb: "february", february: "february",
      mar: "march",   march: "march",
      apr: "april",   april: "april",
      may: "may",
      jun: "june",    june: "june",
      jul: "july",    july: "july",
      aug: "august",  august: "august",
      sep: "september", sept: "september", september: "september",
      oct: "october", october: "october",
      nov: "november", november: "november",
      dec: "december", december: "december",
    };
    const MONTH_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/gi;
    const foundMonths: string[] = [];
    for (const m of lower.matchAll(MONTH_RE)) {
      const canonical = MONTH_CANONICAL[m[1].toLowerCase()];
      if (canonical && !foundMonths.includes(canonical)) foundMonths.push(canonical);
    }

    // ── spacing ───────────────────────────────────────────────────────────────
    const spacingMatch =
      lower.match(/(\d+)\s*days?\s*(?:apart|between|gap|spacing)/i) ??
      lower.match(/at\s+least\s+(\d+)\s*days?/i) ??
      lower.match(/every\s+(\d+)\s*days?/i) ??
      lower.match(/(\d+)\s*day\s*minimum/i);
    const minSpacing = spacingMatch ? parseInt(spacingMatch[1], 10) : undefined;

    // ── day-of-week exclusions ────────────────────────────────────────────────
    const excludeDays: number[] = [];
    if (/\b(no\s+weekends?|weekdays?\s+only|mon(?:day)?\s*(?:through|to|thru|[-–])\s*fri(?:day)?)\b/i.test(lower)) {
      excludeDays.push(0, 6);
    } else {
      if (/\bno\s+sun(?:days?)?\b/i.test(lower)) excludeDays.push(0);
      if (/\bno\s+mon(?:days?)?\b/i.test(lower)) excludeDays.push(1);
      if (/\bno\s+(?:tue|tues)(?:days?)?\b/i.test(lower)) excludeDays.push(2);
      if (/\bno\s+wed(?:nesdays?)?\b/i.test(lower)) excludeDays.push(3);
      if (/\bno\s+thu(?:rs(?:days?)?)?\b/i.test(lower)) excludeDays.push(4);
      if (/\bno\s+fri(?:days?)?\b/i.test(lower)) excludeDays.push(5);
      if (/\bno\s+sat(?:urdays?)?\b/i.test(lower)) excludeDays.push(6);
    }

    // ── team extraction ───────────────────────────────────────────────────────
    // Combined abbreviations first (bv, gv, bjv, gjv)
    let detectedGender: string | undefined;
    let detectedLevel: string | undefined;
    if (/\bbjv\b/i.test(lower))      { detectedGender = "Boys";  detectedLevel = "Junior Varsity"; }
    else if (/\bgjv\b/i.test(lower)) { detectedGender = "Girls"; detectedLevel = "Junior Varsity"; }
    else if (/\bbv\b/i.test(lower))  { detectedGender = "Boys";  detectedLevel = "Varsity"; }
    else if (/\bgv\b/i.test(lower))  { detectedGender = "Girls"; detectedLevel = "Varsity"; }

    if (!detectedGender) {
      if (/\b(boys?|mens?|b)\b/i.test(lower))       detectedGender = "Boys";
      else if (/\b(girls?|womens?|g)\b/i.test(lower)) detectedGender = "Girls";
    }
    if (!detectedLevel) {
      if (/\bjunior\s+varsity\b/i.test(lower))         detectedLevel = "Junior Varsity";
      else if (/\b(jv|j\.v\.)\b/i.test(lower))         detectedLevel = "Junior Varsity";
      else if (/\b(varsity|var|v)\b/i.test(lower))     detectedLevel = "Varsity";
      else if (/\b(frosh|freshman|freshmen|fs)\b/i.test(lower)) detectedLevel = "Freshmen";
    }

    // Multi-word sports first, then single-word
    let detectedSport: string | undefined;
    if      (/\bcross\s+country\b/i.test(lower))  detectedSport = "Cross Country";
    else if (/\bfield\s+hockey\b/i.test(lower))   detectedSport = "Field Hockey";
    else if (/\bwater\s+polo\b/i.test(lower))     detectedSport = "Water Polo";
    else {
      const SPORT_KW: [RegExp, string][] = [
        [/\b(basketball|bball|bb)\b/i, "Basketball"],
        [/\b(football|fb)\b/i,         "Football"],
        [/\bsoccer\b/i,                "Soccer"],
        [/\b(volleyball|vball|vb)\b/i, "Volleyball"],
        [/\bbaseball\b/i,              "Baseball"],
        [/\b(softball|sb)\b/i,         "Softball"],
        [/\btennis\b/i,                "Tennis"],
        [/\bgolf\b/i,                  "Golf"],
        [/\b(swimming|swim)\b/i,       "Swimming"],
        [/\btrack\b/i,                 "Track"],
        [/\blacrosse\b/i,              "Lacrosse"],
        [/\bwrestling\b/i,             "Wrestling"],
        [/\bgymnastics\b/i,            "Gymnastics"],
        [/\bbadminton\b/i,             "Badminton"],
        [/\b(cheer(?:leading)?)\b/i,   "Cheerleading"],
      ];
      for (const [re, name] of SPORT_KW) {
        if (re.test(lower)) { detectedSport = name; break; }
      }
    }

    const targetTeams = (detectedSport || detectedGender || detectedLevel)
      ? [{ sport: detectedSport, gender: detectedGender, level: detectedLevel }]
      : [];

    // ── interpretation ────────────────────────────────────────────────────────
    let interpretation: string;
    if (quotaExceeded) {
      interpretation = "Opletics is experiencing AI token usage at a high volume, try again in a few hours.";
    } else {
      const teamDesc = [detectedGender, detectedLevel, detectedSport].filter(Boolean).join(" ");
      const monthDesc = foundMonths.length
        ? `in ${foundMonths.map(m => m.charAt(0).toUpperCase() + m.slice(1)).join(", ")}`
        : "";
      const spacingDesc = minSpacing ? `at least ${minSpacing} days apart` : "";
      interpretation = ["Finding available dates", teamDesc, monthDesc, spacingDesc]
        .filter(Boolean).join(" ").replace(/\s+/g, " ").trim() + ".";
    }

    const result: ParsedQuery = {
      targetTeams,
      excludeTeams: [],
      interpretation,
      quotaExceeded,
    };
    if (foundMonths.length > 1) result.dateRange = { months: foundMonths };
    else if (foundMonths.length === 1) result.dateRange = { month: foundMonths[0] };
    if (minSpacing) result.minSpacing = minSpacing;
    if (excludeDays.length > 0) result.excludeDays = excludeDays;

    return result;
  }

  /**
   * Normalize parsed query to ensure consistent format
   */
  private normalizeParsedQuery(raw: any): ParsedQuery {
    return {
      targetTeams: Array.isArray(raw.targetTeams) ? raw.targetTeams : [],
      excludeTeams: Array.isArray(raw.excludeTeams) ? raw.excludeTeams : [],
      dateRange: raw.dateRange || undefined,
      minSpacing: typeof raw.minSpacing === "number" ? raw.minSpacing : undefined,
      maxResults: typeof raw.maxResults === "number" ? raw.maxResults : undefined,
      excludeDays: Array.isArray(raw.excludeDays) ? raw.excludeDays : undefined,
      interpretation: typeof raw.interpretation === "string" ? raw.interpretation : undefined,
    };
  }

  /**
   * Generate a human-friendly recommendation/summary based on the found dates
   */
  async generateRecommendation(prompt: string, recommendations: string[], interpretation?: string): Promise<string> {
    if (!openai || recommendations.length === 0) {
      return "";
    }

    const systemPrompt = `You are a sports scheduling assistant. Based on the user's request and the available dates found, provide a brief, helpful summary or recommendation (1-2 sentences).
    
User Request: "${prompt}"
Interpretation: "${interpretation || "Finding available dates"}"
Number of dates found: ${recommendations.length}
Dates found: ${recommendations.slice(0, 10).join(", ")}${recommendations.length > 10 ? "..." : ""}

Provide a friendly response that summarizes the results and maybe highlights why these dates are good (e.g., "I've found several great options for you in December, mostly on Tuesdays and Thursdays which seem to be your preferred game days.").`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: systemPrompt }],
        temperature: 0.7,
        max_tokens: 100,
      });

      return completion.choices[0].message.content || "";
    } catch (error) {
      console.error("AI recommendation generation failed:", error);
      return "";
    }
  }
}

export const availableDatesAIService = new AvailableDatesAIService();
