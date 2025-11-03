import { format } from "date-fns";

interface Game {
  id: string;
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  busTravel: boolean;
  actualDepartureTime?: string | null;
  actualArrivalTime?: string | null;
  homeTeam: {
    name: string;
    level: string;
    sport: {
      name: string;
    };
  };
  opponent?: {
    name: string;
  };
  venue?: {
    name: string;
  };
  location?: string | null;
  notes?: string;
  customData?: any;
}

interface CustomColumn {
  id: string;
  name: string;
}

export class ExportService {
  /**
   * Export games to CSV format
   */
  static exportToCSV(games: Game[], customColumns: CustomColumn[] = [], visibleColumnIds?: string[]): string {
    // Define base column mapping
    const baseColumnMap = new Map<string, { header: string; getValue: (game: Game) => string }>([
      ["date", { header: "Date", getValue: (game) => format(new Date(game.date), "yyyy-MM-dd") }],
      ["time", { header: "Time", getValue: (game) => game.time || "" }],
      ["sport", { header: "Sport", getValue: (game) => game.homeTeam.sport.name }],
      ["level", { header: "Level", getValue: (game) => game.homeTeam.level }],
      ["team", { header: "Team", getValue: (game) => game.homeTeam.name }],
      ["opponent", { header: "Opponent", getValue: (game) => game.opponent?.name || "" }],
      ["isHome", { header: "Location", getValue: (game) => (game.isHome ? "Home" : "Away") }],
      ["location", { header: "Venue", getValue: (game) => game.location || (game.isHome ? "" : game.venue?.name || "") }],
      ["status", { header: "Status", getValue: (game) => game.status }],
      [
        "busTravel",
        {
          header: "Bus Travel",
          getValue: (game) => (game.busTravel ? "Yes" : "No"),
        },
      ],
      [
        "busTravel_departure",
        {
          header: "Departure Time",
          getValue: (game) => (game.actualDepartureTime ? format(new Date(game.actualDepartureTime), "h:mm a") : ""),
        },
      ],
      [
        "busTravel_arrival",
        {
          header: "Arrival Time",
          getValue: (game) => (game.actualArrivalTime ? format(new Date(game.actualArrivalTime), "h:mm a") : ""),
        },
      ],
      ["notes", { header: "Notes", getValue: (game) => game.notes || "" }],
    ]);

    // Filter columns based on visibility if provided
    let columnsToInclude: string[] = [];
    if (visibleColumnIds && visibleColumnIds.length > 0) {
      // Build columns list from visible column IDs
      visibleColumnIds.forEach((colId) => {
        if (colId === "actions") return; // Skip actions column
        if (colId.startsWith("custom:")) {
          columnsToInclude.push(colId);
        } else {
          // For base columns, add them
          columnsToInclude.push(colId);
        }
      });
    } else {
      // If no visibility filter, include all base columns
      columnsToInclude = ["date", "time", "sport", "level", "team", "opponent", "isHome", "location", "status", "busTravel", "notes"];
      // Add all custom columns
      customColumns.forEach((col) => {
        columnsToInclude.push(`custom:${col.id}`);
      });
    }

    // Build headers
    const headers: string[] = [];
    columnsToInclude.forEach((colId) => {
      if (colId.startsWith("custom:")) {
        const customId = colId.split(":")[1];
        const customCol = customColumns.find((col) => col.id === customId);
        if (customCol) {
          headers.push(customCol.name);
        }
      } else if (colId === "busTravel") {
        // BusTravel includes multiple columns
        headers.push("Bus Travel");
        headers.push("Departure Time");
        headers.push("Arrival Time");
      } else {
        const baseCol = baseColumnMap.get(colId);
        if (baseCol) {
          headers.push(baseCol.header);
        }
      }
    });

    // Convert games to CSV rows
    const rows = games.map((game) => {
      const row: string[] = [];
      columnsToInclude.forEach((colId) => {
        if (colId.startsWith("custom:")) {
          const customId = colId.split(":")[1];
          const customData = game.customData || {};
          row.push(customData[customId] || "");
        } else if (colId === "busTravel") {
          // BusTravel includes multiple values
          row.push(game.busTravel ? "Yes" : "No");
          row.push(game.actualDepartureTime ? format(new Date(game.actualDepartureTime), "h:mm a") : "");
          row.push(game.actualArrivalTime ? format(new Date(game.actualArrivalTime), "h:mm a") : "");
        } else if (colId === "team") {
          // Special handling for team which isn't a direct column in the table
          row.push(game.homeTeam.name);
        } else {
          const baseCol = baseColumnMap.get(colId);
          if (baseCol) {
            row.push(baseCol.getValue(game));
          }
        }
      });
      return row;
    });

    // Escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvContent = [headers.map(escapeCSV).join(","), ...rows.map((row) => row.map((cell) => escapeCSV(String(cell))).join(","))].join("\n");

    return csvContent;
  }

  /**
   * Download CSV file
   */
  static downloadCSV(content: string, filename: string = "games_export.csv"): void {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Export and download games
   */
  static exportGames(games: Game[], customColumns: CustomColumn[] = [], visibleColumnIds?: string[]): void {
    const csv = this.exportToCSV(games, customColumns, visibleColumnIds);
    const timestamp = format(new Date(), "yyyy-MM-dd");
    const filename = `games_export_${timestamp}.csv`;
    this.downloadCSV(csv, filename);
  }

  /**
   * Generate filename with timestamp
   */
  static generateFilename(prefix: string = "games"): string {
    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
    return `${prefix}_${timestamp}.csv`;
  }
}
