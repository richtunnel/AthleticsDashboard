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
  };
  minSpacing?: number; // Minimum days between dates
  maxResults?: number;
  excludeDays?: number[]; // Days of week to exclude (0=Sunday, 6=Saturday)
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

Common abbreviations:
- B/Boys, G/Girls for gender
- V/Varsity, JV/Junior Varsity, Frosh/Freshman for level
- BB/Basketball, FB/Football, VB/Volleyball, SB/Softball, etc.

Examples:
- "B V Basketball" → Boys Varsity Basketball
- "GV soccer" → Girls Varsity Soccer
- "not on the same days as boys JV basketball" → exclude Boys Junior Varsity Basketball dates

Return JSON format:
{
  "targetTeams": [{"sport": "Basketball", "gender": "Boys", "level": "Varsity"}],
  "excludeTeams": [{"sport": "Basketball", "gender": "Boys", "level": "Junior Varsity"}],
  "dateRange": {"month": "December", "start": "2024-12-01", "end": "2024-12-31"},
  "minSpacing": 3,
  "excludeDays": [0, 6],
  "maxResults": 10
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
    } catch (error) {
      console.error("AI query parsing failed:", error);
      return this.fallbackParse(prompt);
    }
  }

  /**
   * Fallback parsing when OpenAI is not available
   */
  private fallbackParse(prompt: string): ParsedQuery {
    const lowerPrompt = prompt.toLowerCase();
    const result: ParsedQuery = {
      targetTeams: [],
      excludeTeams: [],
    };

    // Try to extract spacing requirements
    const spacingMatch = lowerPrompt.match(/(\d+)\s*days?\s*apart/);
    if (spacingMatch) {
      result.minSpacing = parseInt(spacingMatch[1], 10);
    }

    // Try to extract month
    const months = [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ];
    for (const month of months) {
      if (lowerPrompt.includes(month)) {
        result.dateRange = { month };
        break;
      }
    }

    // Try to extract exclude conditions
    const excludeMatch = lowerPrompt.match(/not\s+on\s+.*?same\s+days?\s+as\s+(.+?)(?:\s+and|\s+or|$)/);
    if (excludeMatch) {
      // Simple extraction - just store the text for now
      result.excludeTeams = [{ sport: excludeMatch[1].trim() }];
    }

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
    };
  }
}

export const availableDatesAIService = new AvailableDatesAIService();
