import OpenAI from "openai";
import { parsePrompt } from "@/lib/availability/parsePrompt";
import { AvailabilityQuery } from "@/lib/availability/types";

export type { AvailabilityQuery };

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export interface ParsedQueryWithMeta extends AvailabilityQuery {
  _parseMethod?: string;
  _latencyMs?: number;
}

export class AvailableDatesAIService {
  async parseQuery(prompt: string): Promise<ParsedQueryWithMeta> {
    const result = await parsePrompt(prompt, openai);
    return {
      ...result.query,
      _parseMethod: result.method,
      _latencyMs: result.latencyMs,
    };
  }

  async generateRecommendation(
    prompt: string,
    recommendations: string[],
    interpretation?: string
  ): Promise<string> {
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
