import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { calendarOCRService } from "@/lib/services/calendar-ocr.service";

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await requireAuth();

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "No file provided",
        },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid file type. Allowed types: ${allowedTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        {
          success: false,
          error: "File size exceeds 10MB limit",
        },
        { status: 400 }
      );
    }

    console.log(`[OCR Import] Processing file: ${file.name} (${file.type}, ${(file.size / 1024).toFixed(2)} KB) for user ${session.user.id}`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract data using OCR service
    const ocrResult = await calendarOCRService.extractCalendarData(buffer, file.type);

    if (!ocrResult.success || !ocrResult.data) {
      return NextResponse.json(
        {
          success: false,
          error: ocrResult.error || "Failed to extract data from image",
        },
        { status: 400 }
      );
    }

    // Validate extracted data
    const validation = calendarOCRService.validateExtractedData(ocrResult.data);

    console.log(
      `[OCR Import] Successfully extracted ${ocrResult.data.rows.length} rows with ${ocrResult.data.headers.length} columns. Warnings: ${validation.warnings.length}`
    );

    // Return extracted data to client
    return NextResponse.json({
      success: true,
      data: {
        headers: ocrResult.data.headers,
        rows: ocrResult.data.rows,
        metadata: ocrResult.data.metadata,
        warnings: validation.warnings,
        rowCount: ocrResult.data.rows.length,
        columnCount: ocrResult.data.headers.length,
      },
    });
  } catch (error) {
    console.error("[OCR Import] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "An unexpected error occurred during OCR processing",
      },
      { status: 500 }
    );
  }
}
