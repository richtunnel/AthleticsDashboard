import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { importExportService } from "@/lib/services/import-export.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const csv = await importExportService.exportMatchupResultsToCSV(session.user.organizationId);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="score-tracker-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Error exporting score tracker data:", error);
    return new Response("Failed to export score tracker data", { status: 500 });
  }
}
