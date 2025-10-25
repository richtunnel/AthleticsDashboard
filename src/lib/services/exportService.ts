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
  static exportToCSV(games: Game[], customColumns: CustomColumn[] = []): string {
    // Define base headers
    const baseHeaders = ["Date", "Time", "Sport", "Level", "Team", "Opponent", "Location", "Venue", "Status", "Bus Travel", "Departure Time", "Arrival Time", "Notes"];

    // Add custom column headers
    const customHeaders = customColumns.map((col) => col.name);
    const allHeaders = [...baseHeaders, ...customHeaders];

    // Convert games to CSV rows
    const rows = games.map((game) => {
      const baseRow = [
        format(new Date(game.date), "yyyy-MM-dd"),
        game.time || "",
        game.homeTeam.sport.name,
        game.homeTeam.level,
        game.homeTeam.name,
        game.opponent?.name || "",
        game.isHome ? "Home" : "Away",
        game.isHome ? "" : game.venue?.name || "",
        game.status,
        game.busTravel ? "Yes" : "No",
        game.actualDepartureTime ? format(new Date(game.actualDepartureTime), "h:mm a") : "",
        game.actualArrivalTime ? format(new Date(game.actualArrivalTime), "h:mm a") : "",
        game.notes || "",
      ];

      // Add custom column values
      const customValues = customColumns.map((col) => {
        const customData = game.customData || {};
        return customData[col.id] || "";
      });

      return [...baseRow, ...customValues];
    });

    // Escape CSV values
    const escapeCSV = (value: string): string => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    // Build CSV content
    const csvContent = [allHeaders.map(escapeCSV).join(","), ...rows.map((row) => row.map((cell) => escapeCSV(String(cell))).join(","))].join("\n");

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
  static exportGames(games: Game[], customColumns: CustomColumn[] = []): void {
    const csv = this.exportToCSV(games, customColumns);
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
