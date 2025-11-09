import OpenAI from "openai";
import { prisma } from "../database/prisma";
import { format, addDays, isWeekend, parseISO } from "date-fns";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export interface ScheduleGap {
  date: string;
  dayOfWeek: string;
  availableTimeSlots: string[];
  reason: string;
}

export interface SchedulingSuggestion {
  suggestedDate: string;
  suggestedTime: string;
  reason: string;
  conflicts: string[];
  alternativeDates: Array<{
    date: string;
    time: string;
    reason: string;
  }>;
}

export class AISchedulerService {
  async findAvailableSlots(
    organizationId: string,
    sport?: string,
    teamLevel?: string,
    daysAhead: number = 30
  ): Promise<ScheduleGap[]> {
    const startDate = new Date();
    const endDate = addDays(startDate, daysAhead);

    // Get all games in the date range
    const games = await prisma.game.findMany({
      where: {
        homeTeam: {
          organizationId,
          ...(sport ? { sport: { name: sport } } : {}),
          ...(teamLevel ? { level: teamLevel } : {}),
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        homeTeam: {
          include: {
            sport: true,
          },
        },
      },
      orderBy: {
        date: "asc",
      },
    });

    // Build a map of busy dates
    const busyDates = new Map<string, Array<{ time: string; sport: string; level: string }>>();
    games.forEach((game) => {
      const dateKey = format(new Date(game.date), "yyyy-MM-dd");
      if (!busyDates.has(dateKey)) {
        busyDates.set(dateKey, []);
      }
      busyDates.get(dateKey)!.push({
        time: game.time || "TBD",
        sport: game.homeTeam.sport.name,
        level: game.homeTeam.level,
      });
    });

    // Find gaps in schedule
    const gaps: ScheduleGap[] = [];
    let currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = format(currentDate, "yyyy-MM-dd");
      const dayOfWeek = format(currentDate, "EEEE");
      
      // Skip weekends by default (can be made configurable)
      if (isWeekend(currentDate)) {
        currentDate = addDays(currentDate, 1);
        continue;
      }

      const busySlots = busyDates.get(dateKey) || [];
      
      // If no games scheduled, it's available
      if (busySlots.length === 0) {
        gaps.push({
          date: dateKey,
          dayOfWeek,
          availableTimeSlots: ["3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"],
          reason: "No games scheduled on this day",
        });
      } else if (busySlots.length < 3) {
        // Some slots available
        const busyTimes = busySlots.map((s) => s.time);
        const allTimes = ["3:00 PM", "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM"];
        const availableSlots = allTimes.filter((t) => !busyTimes.includes(t));
        
        if (availableSlots.length > 0) {
          gaps.push({
            date: dateKey,
            dayOfWeek,
            availableTimeSlots: availableSlots,
            reason: `${busySlots.length} game(s) already scheduled`,
          });
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    return gaps;
  }

  async suggestSchedule(
    organizationId: string,
    requestDetails: {
      opponentName: string;
      sport: string;
      teamLevel: string;
      preferredDates?: string[];
      preferredTimes?: string[];
      homeOrAway: "home" | "away";
    }
  ): Promise<SchedulingSuggestion> {
    const availableSlots = await this.findAvailableSlots(
      organizationId,
      requestDetails.sport,
      requestDetails.teamLevel,
      45 // Look 45 days ahead
    );

    if (!openai) {
      // Fallback: simple logic-based suggestion
      const bestSlot = availableSlots[0];
      if (!bestSlot) {
        throw new Error("No available slots found in the next 45 days");
      }

      return {
        suggestedDate: bestSlot.date,
        suggestedTime: bestSlot.availableTimeSlots[0],
        reason: "First available slot (OpenAI not configured)",
        conflicts: [],
        alternativeDates: availableSlots.slice(1, 4).map((slot) => ({
          date: slot.date,
          time: slot.availableTimeSlots[0],
          reason: slot.reason,
        })),
      };
    }

    // Use AI to make intelligent suggestions
    const prompt = `You are an athletic director assistant helping to schedule a game. 

Request Details:
- Opponent: ${requestDetails.opponentName}
- Sport: ${requestDetails.sport}
- Level: ${requestDetails.teamLevel}
- Type: ${requestDetails.homeOrAway} game
${requestDetails.preferredDates ? `- Preferred Dates: ${requestDetails.preferredDates.join(", ")}` : ""}
${requestDetails.preferredTimes ? `- Preferred Times: ${requestDetails.preferredTimes.join(", ")}` : ""}

Available Slots (next 45 days):
${availableSlots
  .slice(0, 10)
  .map((slot) => `- ${slot.dayOfWeek}, ${slot.date}: ${slot.availableTimeSlots.join(", ")} (${slot.reason})`)
  .join("\n")}

Based on the available slots and preferences, suggest the best date and time for this game. Consider:
1. Preferred dates/times if provided
2. Day of week (Tuesdays/Thursdays are common for games)
3. Time slots that work well for the sport and level
4. Spacing between games (avoid back-to-back days if possible)

Provide your response in this exact JSON format:
{
  "suggestedDate": "YYYY-MM-DD",
  "suggestedTime": "H:MM AM/PM",
  "reason": "Brief explanation of why this is the best option",
  "conflicts": ["Any potential conflicts or concerns"],
  "alternativeDates": [
    {"date": "YYYY-MM-DD", "time": "H:MM AM/PM", "reason": "Why this is a good alternative"}
  ]
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const suggestion = JSON.parse(completion.choices[0].message.content || "{}");

      return {
        suggestedDate: suggestion.suggestedDate,
        suggestedTime: suggestion.suggestedTime,
        reason: suggestion.reason,
        conflicts: suggestion.conflicts || [],
        alternativeDates: suggestion.alternativeDates || [],
      };
    } catch (error) {
      console.error("AI suggestion failed:", error);
      
      // Fallback to simple logic
      const bestSlot = availableSlots[0];
      if (!bestSlot) {
        throw new Error("No available slots found");
      }

      return {
        suggestedDate: bestSlot.date,
        suggestedTime: bestSlot.availableTimeSlots[0],
        reason: "First available slot (AI error fallback)",
        conflicts: [],
        alternativeDates: availableSlots.slice(1, 4).map((slot) => ({
          date: slot.date,
          time: slot.availableTimeSlots[0],
          reason: slot.reason,
        })),
      };
    }
  }

  async generateSchedulingEmail(
    organizationId: string,
    suggestion: SchedulingSuggestion,
    recipientInfo: {
      schoolName: string;
      contactName?: string;
      sport: string;
      teamLevel: string;
      homeOrAway: "home" | "away";
    }
  ): Promise<{ subject: string; body: string }> {
    if (!openai) {
      // Fallback email template
      return {
        subject: `Game Scheduling Request - ${recipientInfo.sport} (${recipientInfo.teamLevel})`,
        body: `Dear ${recipientInfo.contactName || "Athletic Director"},\n\nI hope this email finds you well. I am reaching out to schedule a ${recipientInfo.teamLevel} ${recipientInfo.sport} game between our schools.\n\nBased on our current schedule, I would like to propose the following:\n\nDate: ${format(parseISO(suggestion.suggestedDate), "EEEE, MMMM d, yyyy")}\nTime: ${suggestion.suggestedTime}\nLocation: ${recipientInfo.homeOrAway === "home" ? "Our facility" : "Your facility"}\n\n${suggestion.alternativeDates.length > 0 ? `Alternative dates:\n${suggestion.alternativeDates.map((alt) => `- ${format(parseISO(alt.date), "EEEE, MMMM d, yyyy")} at ${alt.time}`).join("\n")}\n\n` : ""}Please let me know if this works for your schedule. I look forward to hearing from you.\n\nBest regards`,
      };
    }

    const prompt = `You are an athletic director writing a professional email to schedule a game with another school.

Details:
- Recipient School: ${recipientInfo.schoolName}
${recipientInfo.contactName ? `- Contact: ${recipientInfo.contactName}` : ""}
- Sport: ${recipientInfo.sport}
- Level: ${recipientInfo.teamLevel}
- Proposed Date: ${format(parseISO(suggestion.suggestedDate), "EEEE, MMMM d, yyyy")}
- Proposed Time: ${suggestion.suggestedTime}
- Location: ${recipientInfo.homeOrAway === "home" ? "Our facility (Home game for us)" : "Your facility (Away game for us)"}
${suggestion.alternativeDates.length > 0 ? `- Alternative Dates: ${suggestion.alternativeDates.map((alt) => format(parseISO(alt.date), "MMM d") + " at " + alt.time).join(", ")}` : ""}

Write a professional, friendly email that:
1. Proposes the main date/time
2. Mentions alternative dates if any
3. Asks for confirmation or counter-proposal
4. Is concise and courteous
5. Includes appropriate athletic director tone

Provide your response in this exact JSON format:
{
  "subject": "Email subject line",
  "body": "Email body text"
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });

      const email = JSON.parse(completion.choices[0].message.content || "{}");

      return {
        subject: email.subject || `Game Scheduling Request - ${recipientInfo.sport}`,
        body: email.body || "",
      };
    } catch (error) {
      console.error("AI email generation failed:", error);
      
      // Fallback email
      return {
        subject: `Game Scheduling Request - ${recipientInfo.sport} (${recipientInfo.teamLevel})`,
        body: `Dear ${recipientInfo.contactName || "Athletic Director"},\n\nI hope this email finds you well. I am reaching out to schedule a ${recipientInfo.teamLevel} ${recipientInfo.sport} game between our schools.\n\nBased on our current schedule, I would like to propose the following:\n\nDate: ${format(parseISO(suggestion.suggestedDate), "EEEE, MMMM d, yyyy")}\nTime: ${suggestion.suggestedTime}\nLocation: ${recipientInfo.homeOrAway === "home" ? "Our facility" : "Your facility"}\n\n${suggestion.alternativeDates.length > 0 ? `Alternative dates:\n${suggestion.alternativeDates.map((alt) => `- ${format(parseISO(alt.date), "EEEE, MMMM d, yyyy")} at ${alt.time}`).join("\n")}\n\n` : ""}Please let me know if this works for your schedule. I look forward to hearing from you.\n\nBest regards`,
      };
    }
  }
}

export const aiSchedulerService = new AISchedulerService();
