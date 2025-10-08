import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { importExportService } from "@/lib/services/import-export.service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    const csv = await importExportService.exportGamesToCSV(session.user.organizationId);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="games-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    return new Response("Failed to export games", { status: 500 });
  }
}
