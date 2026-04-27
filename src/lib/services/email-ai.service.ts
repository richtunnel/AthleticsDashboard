import OpenAI from "openai";
import { prisma } from "../database/prisma";
import { format } from "date-fns";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

interface EmailGenerationParams {
  type: "game_notification" | "schedule_update" | "travel_info" | "cancellation" | "reminder" | "custom";
  gameId?: string;
  gameIds?: string[];
  recipientRole?: string;
  tone?: "formal" | "casual" | "friendly";
  additionalContext?: string;
  includeDetails?: string[];
}

interface GeneratedEmail {
  subject: string;
  body: string;
  preview: string;
  suggestions: string[];
}

export class EmailAIService {
  async generateEmail(
    organizationId: string,
    params: EmailGenerationParams
  ): Promise<GeneratedEmail> {
    const { type, gameId, gameIds, recipientRole = "parents", tone = "friendly", additionalContext, includeDetails } = params;

    let gameData: any[] = [];

    if (gameId) {
      const game = await this.fetchGameDetails(gameId, organizationId);
      if (game) gameData = [game];
    } else if (gameIds && gameIds.length > 0) {
      gameData = await Promise.all(
        gameIds.map((id) => this.fetchGameDetails(id, organizationId))
      );
      gameData = gameData.filter((g) => g !== null);
    }

    if (!openai) {
      return this.generateFallbackEmail(type, gameData, tone, additionalContext);
    }

    const prompt = this.buildPrompt(type, gameData, recipientRole, tone, additionalContext, includeDetails);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional athletic director assistant who writes clear, engaging, and informative emails for scheduling and communications.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");

      return {
        subject: result.subject || "Game Schedule Information",
        body: result.body || "No content generated",
        preview: result.preview || result.subject?.substring(0, 100) || "",
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      console.error("AI email generation failed:", error);
      return this.generateFallbackEmail(type, gameData, tone, additionalContext);
    }
  }

  async generateMultipleVariations(
    organizationId: string,
    params: EmailGenerationParams,
    count: number = 3
  ): Promise<GeneratedEmail[]> {
    const variations: GeneratedEmail[] = [];

    for (let i = 0; i < count; i++) {
      const email = await this.generateEmail(organizationId, {
        ...params,
        additionalContext: `${params.additionalContext || ""} (Variation ${i + 1})`,
      });
      variations.push(email);
    }

    return variations;
  }

  async improveEmail(
    originalSubject: string,
    originalBody: string,
    improvements: string[]
  ): Promise<GeneratedEmail> {
    if (!openai) {
      return {
        subject: originalSubject,
        body: originalBody,
        preview: originalSubject.substring(0, 100),
        suggestions: ["OpenAI not configured - using original email"],
      };
    }

    const prompt = `Please improve the following email based on these requirements:

Original Subject: ${originalSubject}
Original Body: ${originalBody}

Improvements Requested:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join("\n")}

Return a JSON object with:
{
  "subject": "improved subject line",
  "body": "improved email body in HTML format",
  "preview": "short preview text",
  "suggestions": ["what was improved", "other recommendations"]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an expert email writer who improves clarity, engagement, and professionalism.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(completion.choices[0].message.content || "{}");

      return {
        subject: result.subject || originalSubject,
        body: result.body || originalBody,
        preview: result.preview || result.subject?.substring(0, 100) || "",
        suggestions: result.suggestions || [],
      };
    } catch (error) {
      console.error("Email improvement failed:", error);
      return {
        subject: originalSubject,
        body: originalBody,
        preview: originalSubject.substring(0, 100),
        suggestions: ["Error improving email - using original"],
      };
    }
  }

  private buildPrompt(
    type: string,
    gameData: any[],
    recipientRole: string,
    tone: string,
    additionalContext?: string,
    includeDetails?: string[]
  ): string {
    const gameInfo = gameData
      .map(
        (game) => `
Game: ${game.homeTeam.sport.name} - ${game.homeTeam.level}
Date: ${format(new Date(game.date), "MM/dd/yyyy")}
Time: ${game.time || "TBD"}
Opponent: ${game.opponent?.name || "TBD"}
Location: ${game.isHome ? "Home" : game.venue ? `${game.venue.name}, ${game.venue.city}` : "TBD"}
${
  game.travelRequired
    ? `Travel Required: Yes
Travel Time: ${game.estimatedTravelTime || "TBD"} minutes
Departure Time: ${game.departureTime ? new Date(game.departureTime).toLocaleTimeString() : "TBD"}
Buses: ${game.busCount || "TBD"}`
    : ""
}
${game.notes ? `Notes: ${game.notes}` : ""}
`
      )
      .join("\n---\n");

    let basePrompt = "";

    switch (type) {
      case "game_notification":
        basePrompt = `Write a ${tone} email to ${recipientRole} notifying them about upcoming game(s). Include all relevant details like date, time, location, and any special instructions.`;
        break;
      case "schedule_update":
        basePrompt = `Write a ${tone} email to ${recipientRole} about schedule changes or updates. Clearly highlight what has changed and why.`;
        break;
      case "travel_info":
        basePrompt = `Write a ${tone} email to ${recipientRole} with detailed travel information for away game(s). Include departure times, bus information, what to bring, and arrival details.`;
        break;
      case "cancellation":
        basePrompt = `Write a ${tone} email to ${recipientRole} about game cancellation(s). Be clear about the reason and any rescheduling plans.`;
        break;
      case "reminder":
        basePrompt = `Write a ${tone} reminder email to ${recipientRole} about upcoming game(s). Keep it concise but informative.`;
        break;
      case "custom":
        basePrompt = `Write a ${tone} email to ${recipientRole} about the game(s). ${additionalContext || ""}`;
        break;
    }

    const detailsInstructions = includeDetails?.length
      ? `\n\nMake sure to include these specific details: ${includeDetails.join(", ")}`
      : "";

    return `${basePrompt}

Game Information:
${gameInfo}

${additionalContext ? `Additional Context:\n${additionalContext}\n` : ""}
${detailsInstructions}

Return a JSON object with:
{
  "subject": "email subject line",
  "body": "email body in HTML format with proper formatting",
  "preview": "short preview text (max 100 chars)",
  "suggestions": ["tip 1", "tip 2", "tip 3"] - tips for improving or customizing the email
}

Make the email professional, clear, and easy to read. Use HTML formatting for better presentation.`;
  }

  private async fetchGameDetails(gameId: string, organizationId: string): Promise<any | null> {
    try {
      const game = await prisma.game.findFirst({
        where: {
          id: gameId,
          homeTeam: {
            organizationId,
          },
        },
        include: {
          homeTeam: {
            include: {
              sport: true,
            },
          },
          opponent: true,
          venue: true,
        },
      });

      return game;
    } catch (error) {
      console.error("Failed to fetch game details:", error);
      return null;
    }
  }

  private generateFallbackEmail(
    type: string,
    gameData: any[],
    tone: string,
    additionalContext?: string
  ): GeneratedEmail {
    if (gameData.length === 0) {
      return {
        subject: "Game Schedule Information",
        body: "<p>Game schedule information will be available soon.</p>",
        preview: "Game schedule information",
        suggestions: ["Add game details to generate a complete email"],
      };
    }

    const game = gameData[0];
    let subject = "";
    let body = "";

    switch (type) {
      case "game_notification":
        subject = `Upcoming Game: ${game.homeTeam.sport.name} vs ${game.opponent?.name || "TBD"}`;
        body = this.buildFallbackGameNotification(game);
        break;
      case "travel_info":
        subject = `Travel Information: ${game.homeTeam.sport.name} at ${game.venue?.name || "Away"}`;
        body = this.buildFallbackTravelInfo(game);
        break;
      case "cancellation":
        subject = `Game Cancellation: ${game.homeTeam.sport.name} on ${format(new Date(game.date), "MM/dd/yyyy")}`;
        body = `<p>We regret to inform you that the ${game.homeTeam.sport.name} game scheduled for ${format(new Date(game.date), "MM/dd/yyyy")} has been cancelled.</p><p>We will notify you of any rescheduling plans.</p>`;
        break;
      default:
        subject = `Game Information: ${game.homeTeam.sport.name}`;
        body = this.buildFallbackGameNotification(game);
    }

    if (additionalContext) {
      body += `<p><strong>Additional Information:</strong></p><p>${additionalContext}</p>`;
    }

    return {
      subject,
      body,
      preview: subject.substring(0, 100),
      suggestions: ["Configure OpenAI for AI-powered email generation"],
    };
  }

  private buildFallbackGameNotification(game: any): string {
    return `
      <h2>Game Information</h2>
      <p><strong>Date:</strong> ${format(new Date(game.date), "MM/dd/yyyy")}</p>
      <p><strong>Time:</strong> ${game.time || "TBD"}</p>
      <p><strong>Sport:</strong> ${game.homeTeam.sport.name}</p>
      <p><strong>Level:</strong> ${game.homeTeam.level}</p>
      <p><strong>Opponent:</strong> ${game.opponent?.name || "TBD"}</p>
      <p><strong>Location:</strong> ${game.isHome ? "Home" : game.venue ? `${game.venue.name}, ${game.venue.city}` : "TBD"}</p>
      ${
        game.travelRequired
          ? `
        <h3>Travel Information</h3>
        <p><strong>Departure Time:</strong> ${game.departureTime ? new Date(game.departureTime).toLocaleTimeString() : "TBD"}</p>
        <p><strong>Estimated Travel Time:</strong> ${game.estimatedTravelTime || "TBD"} minutes</p>
      `
          : ""
      }
      ${game.notes ? `<p><strong>Notes:</strong> ${game.notes}</p>` : ""}
    `;
  }

  private buildFallbackTravelInfo(game: any): string {
    return `
      <h2>Travel Information</h2>
      <p><strong>Game Date:</strong> ${format(new Date(game.date), "MM/dd/yyyy")}</p>
      <p><strong>Game Time:</strong> ${game.time || "TBD"}</p>
      <p><strong>Destination:</strong> ${game.venue ? `${game.venue.name}, ${game.venue.city}, ${game.venue.state}` : "TBD"}</p>
      <p><strong>Departure Time:</strong> ${game.departureTime ? new Date(game.departureTime).toLocaleTimeString() : "TBD"}</p>
      <p><strong>Estimated Travel Time:</strong> ${game.estimatedTravelTime || "TBD"} minutes</p>
      ${game.busCount ? `<p><strong>Buses:</strong> ${game.busCount}</p>` : ""}
      <h3>What to Bring</h3>
      <ul>
        <li>Team uniform</li>
        <li>Water bottle</li>
        <li>Snacks</li>
        <li>Any required equipment</li>
      </ul>
      <p>Please arrive at the departure location 15 minutes early.</p>
    `;
  }
}

export const emailAIService = new EmailAIService();
