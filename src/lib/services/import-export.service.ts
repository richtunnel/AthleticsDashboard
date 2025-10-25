import { prisma } from "../database/prisma";
import { format } from "date-fns";

export class ImportExportService {
  async exportGamesToCSV(organizationId: string): Promise<string> {
    const games = await prisma.game.findMany({
      where: {
        homeTeam: { organizationId },
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        opponent: true,
        venue: true,
      },
      orderBy: { date: "asc" },
    });

    // CSV Headers
    const headers = [
      "Date",
      "Time",
      "Sport",
      "Level",
      "Team",
      "Opponent",
      "Location Type",
      "Venue",
      "Status",
      "Travel Required",
      "Bus Travel",
      "Departure Time",
      "Arrival Time",
      "Travel Time (min)",
      "Bus Count",
      "Travel Cost",
      "Notes",
    ];

    // Convert games to CSV rows
    const rows = games.map((game: any) => [
      format(new Date(game.date), "yyyy-MM-dd"),
      game.time || "",
      game.homeTeam.sport.name,
      game.homeTeam.level,
      game.homeTeam.name,
      game.opponent?.name || "",
      game.isHome ? "Home" : "Away",
      game.venue?.name || "",
      game.status,
      game.travelRequired ? "Yes" : "No",
      game.busTravel ? "Yes" : "No",
      game.actualDepartureTime ? format(new Date(game.actualDepartureTime), "h:mm a") : "",
      game.actualArrivalTime ? format(new Date(game.actualArrivalTime), "h:mm a") : "",
      game.estimatedTravelTime?.toString() || "",
      game.busCount?.toString() || "",
      game.travelCost?.toString() || "",
      game.notes || "",
    ]);

    // Combine headers and rows
    const csvContent = [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");

    return csvContent;
  }

  async importGamesFromCSV(csvContent: string, userId: string, organizationId: string): Promise<{ success: number; errors: string[] }> {
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

    let success = 0;
    const errors: string[] = [];

    // Get reference data
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: { sport: true },
    });

    const opponents = await prisma.opponent.findMany({
      where: { organizationId },
    });

    const venues = await prisma.venue.findMany({
      where: { organizationId },
    });

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        // Parse CSV line (handle quoted values)
        const values = this.parseCSVLine(line);
        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || "";
        });

        // Find matching team
        const team = teams.find((t: any) => t.sport.name === row["Sport"] && t.level === row["Level"] && (row["Team"] ? t.name === row["Team"] : true));

        if (!team) {
          errors.push(`Line ${i + 1}: Team not found for ${row["Sport"]} ${row["Level"]}`);
          continue;
        }

        // Find opponent
        const opponent = row["Opponent"] ? opponents.find((o: any) => o.name === row["Opponent"]) : null;

        // Find venue
        const venue = row["Venue"] ? venues.find((v: any) => v.name === row["Venue"]) : null;

        // Parse date
        const date = new Date(row["Date"]);
        if (isNaN(date.getTime())) {
          errors.push(`Line ${i + 1}: Invalid date format`);
          continue;
        }

        // Create game
        await prisma.game.create({
          data: {
            date,
            time: row["Time"] || null,
            status: (row["Status"] as any) || "SCHEDULED",
            isHome: row["Location Type"]?.toLowerCase() === "home",
            notes: row["Notes"] || null,
            travelRequired: row["Travel Required"]?.toLowerCase() === "yes",
            busTravel: row["Bus Travel"]?.toLowerCase() === "yes",
            estimatedTravelTime: row["Travel Time (min)"] ? parseInt(row["Travel Time (min)"]) : null,
            busCount: row["Bus Count"] ? parseInt(row["Bus Count"]) : null,
            travelCost: row["Travel Cost"] ? parseFloat(row["Travel Cost"]) : null,
            homeTeamId: team.id,
            opponentId: opponent?.id || null,
            venueId: venue?.id || null,
            createdById: userId,
          },
        });

        success++;
      } catch (error) {
        errors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    return { success, errors };
  }

  async exportTeamsToCSV(organizationId: string): Promise<string> {
    const teams = await prisma.team.findMany({
      where: { organizationId },
      include: { sport: true },
      orderBy: [{ sport: { name: "asc" } }, { level: "asc" }],
    });

    const headers = ["Team Name", "Sport", "Level", "Gender"];

    const rows = teams.map((team: any) => [team.name, team.sport.name, team.level, team.gender || ""]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  async exportVenuesToCSV(organizationId: string): Promise<string> {
    const venues = await prisma.venue.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    const headers = ["Venue Name", "Address", "City", "State", "ZIP", "Notes"];

    const rows = venues.map((venue: any) => [venue.name, venue.address || "", venue.city || "", venue.state || "", venue.zipCode || "", venue.notes || ""]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  async exportOpponentsToCSV(organizationId: string): Promise<string> {
    const opponents = await prisma.opponent.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });

    const headers = ["Name", "Mascot", "Colors", "Contact", "Phone", "Email", "Notes"];

    const rows = opponents.map((opponent: any) => [
      opponent.name,
      opponent.mascot || "",
      opponent.colors || "",
      opponent.contact || "",
      opponent.phone || "",
      opponent.email || "",
      opponent.notes || "",
    ]);

    return [headers.join(","), ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(","))].join("\n");
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }
}

export const importExportService = new ImportExportService();
