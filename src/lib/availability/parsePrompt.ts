import OpenAI from "openai";
import { AvailabilityQuery, ParseResult, ParseMethod } from "./types";
import { fallbackParse } from "./fallbackParser";
import { validateAIResponse, tryParseJSON } from "./validateAIResponse";
import { trackServerEvent } from "@/lib/analytics/mixpanel.server";

const AI_TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = `You are a sports scheduling assistant. Parse natural language queries about finding available dates.

Extract the following information:
1. targetTeams: teams to find dates FOR — include sport, gender, and level if mentioned
2. excludeTeams: teams whose dates should be AVOIDED — include sport, gender, and level if mentioned
3. dateRange: date constraints. Use:
   - "month" (single month, lowercase) or "months" (array, lowercase) for month filters
   - "start" and "end" (YYYY-MM-DD) for explicit or relative ranges
   - "weekOfMonth" (integer 1–5) for "first/second/third/fourth/last week of [month]"
   - "year" (integer) when a specific year is mentioned
4. weekdaysToInclude: array of weekday indices (0=Sun,1=Mon,...,6=Sat) when user wants ONLY specific days
   — Use for: "open Fridays", "Mondays only", "only Wednesdays", "on Tuesdays"
5. excludeDays: array of weekday indices to exclude — use for "no weekends", "no Sundays", weekdays only
   IMPORTANT: never put the same day in both weekdaysToInclude and excludeDays
6. minSpacing: minimum days between dates (integer)
7. maxResults: maximum number of results (integer 1–50)
8. interpretation: a human-friendly sentence summarizing the query

IMPORTANT — words to IGNORE as team characteristics:
"open", "available", "free", "empty", "clear", "good", "best", "suitable"

Common abbreviations:
B/Boys, G/Girls for gender
V/Varsity, JV/Junior Varsity, Frosh/Freshman for level
BB/Basketball, FB/Football, VB/Volleyball, SB/Softball, etc.

Examples:
- "open Fridays in March for boys varsity basketball"
  → targetTeams:[{sport:"Basketball",gender:"Boys",level:"Varsity"}], weekdaysToInclude:[5], dateRange:{month:"march"}
- "first week of June for girls soccer"
  → targetTeams:[{sport:"Soccer",gender:"Girls"}], dateRange:{month:"june",weekOfMonth:1}
- "this weekend" → dateRange:{start:"YYYY-MM-DD",end:"YYYY-MM-DD"} (resolve relative to today)
- "next month" → dateRange:{start:"YYYY-MM-DD",end:"YYYY-MM-DD"}
- "between May 12 and May 18" → dateRange:{start:"YYYY-05-12",end:"YYYY-05-18"}
- "Mondays and Wednesdays in March" → weekdaysToInclude:[1,3], dateRange:{month:"march"}
- "no weekends" → excludeDays:[0,6]
- "weekdays only" → excludeDays:[0,6]
- "find open dates in september, july and august for boys varsity basketball"
  → targetTeams:[{sport:"Basketball",gender:"Boys",level:"Varsity"}], dateRange:{months:["september","july","august"]}

IMPORTANT: weekdaysToInclude means ONLY return dates on those days. excludeDays means skip those days.

Return JSON with this shape:
{
  "targetTeams": [{"sport": "...", "gender": "...", "level": "..."}],
  "excludeTeams": [],
  "dateRange": {"month": "...", "weekOfMonth": 1},
  "weekdaysToInclude": [],
  "excludeDays": [],
  "minSpacing": 3,
  "maxResults": 10,
  "interpretation": "..."
}`;

export async function parsePrompt(
  prompt: string,
  openai: OpenAI | null
): Promise<ParseResult> {
  const start = Date.now();

  if (!openai) {
    const { query, method } = fallbackParse(prompt);
    return { query, method, latencyMs: Date.now() - start };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  let rawContent: string | undefined;
  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: "json_object" },
      },
      { signal: controller.signal }
    );
    clearTimeout(timer);

    rawContent = completion.choices[0]?.message?.content ?? "";
    const parsed = tryParseJSON(rawContent);
    if (parsed === null) {
      throw new Error("INVALID_JSON");
    }

    const validated = validateAIResponse(parsed);
    const latencyMs = Date.now() - start;

    trackServerEvent("Available Dates - Parse", {
      method: "ai",
      latencyMs,
      promptLength: prompt.length,
    });

    return { query: validated, method: "ai", latencyMs, rawAIResponse: rawContent };
  } catch (err: any) {
    clearTimeout(timer);

    let fallbackMethod: ParseMethod;
    const msg: string = err?.message ?? String(err);
    const isAbort = err?.name === "AbortError" || msg === "AI_TIMEOUT";
    const isQuota = err?.status === 429 || err?.code === "insufficient_quota";

    if (isAbort) {
      fallbackMethod = "fallback-timeout";
    } else if (msg === "INVALID_JSON") {
      fallbackMethod = "fallback-invalid";
    } else if (isQuota) {
      fallbackMethod = "fallback-quota";
    } else {
      fallbackMethod = "fallback";
    }

    console.warn(
      "[parsePrompt] Fell back to deterministic parser. Reason:",
      msg
    );

    const { query } = fallbackParse(prompt, {
      quotaExceeded: fallbackMethod === "fallback-quota",
    });
    const latencyMs = Date.now() - start;

    trackServerEvent("Available Dates - Parse", {
      method: fallbackMethod,
      latencyMs,
      reason: msg,
      promptLength: prompt.length,
    });

    return { query, method: fallbackMethod, latencyMs, rawAIResponse: rawContent };
  }
}
