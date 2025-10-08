import { handleApiError } from "@/lib/utils/error-handler";
import { ApiResponse } from "@/lib/utils/api-response";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiResponse.error("No file provided");
    }

    const csvContent = await file.text();

    const result = await importExportService.importGamesFromCSV(csvContent, session.user.id, session.user.organizationId);

    return ApiResponse.success(result);
  } catch (error) {
    return handleApiError(error);
  }
}
