import { NextRequest } from "next/server";
import { handleApiError } from "@/lib/utils/error-handler";
import { ApiResponse } from "@/lib/utils/api-response";
import { requireAuth } from "@/lib/utils/auth";
import { calendarOCRService, OCRExtractionResult } from "@/lib/services/calendar-ocr.service";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return ApiResponse.error("No image file provided");
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return ApiResponse.error(
        `Invalid file type: ${file.type}. Please upload JPEG, PNG, or WebP images only.`
      );
    }

    // Convert file to buffer
    const imageBuffer = Buffer.from(await file.arrayBuffer());

    // Process image through OCR service
    const ocrResult: OCRExtractionResult = await calendarOCRService.extractGamesFromImage(
      imageBuffer,
      file.name
    );

    if (!ocrResult.success) {
      const errorMessage = ocrResult.errors.length > 0 
        ? `Image processing failed: ${ocrResult.errors[0]}`
        : "Image processing failed";
        
      const suggestions = ocrResult.metadata.suggestions.length > 0 
        ? ocrResult.metadata.suggestions.join('; ')
        : "Try improving image quality or convert to CSV";

      return ApiResponse.error(`${errorMessage}. Suggestions: ${suggestions}`);
    }

    // Transform OCR data to match CSV import format
    const transformedData = transformOCRToImportFormat(ocrResult);

    return ApiResponse.success({
      ocrResult,
      transformedData,
      importData: {
        headers: transformedData.headers,
        data: transformedData.data,
        metadata: {
          ...ocrResult.metadata,
          source: 'ocr',
          fileName: file.name,
          originalSize: imageBuffer.length,
        },
      },
    });
  } catch (error) {
    console.error('OCR import error:', error);
    return handleApiError(error);
  }
}

function transformOCRToImportFormat(ocrResult: OCRExtractionResult): {
  headers: string[];
  data: Array<Record<string, any>>;
} {
  // Standard headers that we'll map to
  const standardHeaders = ['date'];
  
  // Collect all unique field names from OCR results
  const allFields = new Set<string>();
  ocrResult.data.forEach(game => {
    const gameObj = game as any; // Allow arbitrary properties for OCR data
    Object.keys(gameObj).forEach(key => {
      if (key !== 'confidence' && key !== 'rawText' && gameObj[key]) {
        allFields.add(key);
      }
    });
  });

  // Create ordered headers (date first, then other fields)
  const headers = [...standardHeaders, ...Array.from(allFields).sort()];

  // Transform each game to match CSV import format
  const data = ocrResult.data.map(game => {
    const row: Record<string, any> = {};
    const gameObj = game as any; // Allow arbitrary properties for OCR data
    
    headers.forEach(header => {
      switch (header) {
        case 'date':
          row[header] = game.date || '';
          break;
        default:
          // Map OCR fields to our standard field names
          const fieldValue = gameObj[header];
          row[header] = fieldValue || '';
          break;
      }
    });

    // Add metadata
    row._ocr_confidence = game.confidence;
    row._ocr_raw_text = game.rawText || '';

    return row;
  });

  return { headers, data };
}