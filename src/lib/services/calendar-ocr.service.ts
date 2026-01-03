import OpenAI from "openai";

interface OCRResult {
  success: boolean;
  data?: OCRExtractedData;
  error?: string;
}

interface OCRExtractedData {
  headers: string[];
  rows: Record<string, string | number | null>[];
  metadata?: {
    calendarType?: string; // "monthly" | "weekly" | "daily" | "spreadsheet"
    month?: string;
    year?: string;
    notes?: string;
  };
}

export class CalendarOCRService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Extract game schedule data from a calendar or spreadsheet image
   * @param imageBuffer - Buffer containing the image data
   * @param mimeType - MIME type of the image (image/jpeg, image/png, etc)
   * @returns OCRResult with extracted data
   */
  async extractCalendarData(imageBuffer: Buffer, mimeType: string): Promise<OCRResult> {
    try {
      // Convert buffer to base64
      const base64Image = imageBuffer.toString("base64");
      const dataUrl = `data:${mimeType};base64,${base64Image}`;

      // Call OpenAI Vision API with detailed prompt for calendar/schedule extraction
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o", // Using gpt-4o for better vision and speed
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting game schedule data from calendar images and handwritten notes.
Your task is to analyze images of printed or handwritten calendars, spreadsheets, or schedules and extract game/event information.

IMPORTANT INSTRUCTIONS:
1. Look for dates and any associated information (teams, opponents, times, locations, notes, etc.)
2. Extract ALL visible columns/fields, even if handwritten or unclear
3. For calendars: Extract data from each day that has information
4. For spreadsheets: Extract the header row and all data rows
5. Preserve the original column names/headers as they appear in the image
6. If dates are written in calendar grid format (day numbers), infer the full date from context
7. Handle various date formats (MM/DD, DD/MM, written dates, etc.)
8. Extract times in any format (12h, 24h, handwritten)
9. If text is unclear, make your best guess but mark uncertainty in notes

OUTPUT FORMAT:
Return ONLY a valid JSON object with this structure:
{
  "headers": ["Date", "Opponent", "Time", "Location", ...],  // Column names as they appear
  "rows": [
    {"Date": "2024-01-15", "Opponent": "Lincoln High", "Time": "3:00 PM", ...},
    ...
  ],
  "metadata": {
    "calendarType": "monthly" or "weekly" or "spreadsheet",
    "month": "January",
    "year": "2024",
    "notes": "Any important observations or uncertainties"
  }
}

IMPORTANT: 
- dates MUST be in YYYY-MM-DD format
- If only day numbers are visible, use context (month/year from title) to construct full dates
- Include empty/null values for missing data
- Preserve all handwritten notes and annotations`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please extract all game schedule information from this calendar/schedule image. Return the data as a JSON object following the format specified.",
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl,
                  detail: "high", // Use high detail for better OCR accuracy
                },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1, // Low temperature for more consistent/accurate extraction
      });

      // Parse the response
      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: "No response from OCR service",
        };
      }

      // Extract JSON from response (handle cases where GPT might add explanation text)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          success: false,
          error: "Could not parse OCR response. The image may not contain recognizable calendar or schedule data.",
        };
      }

      const extractedData = JSON.parse(jsonMatch[0]) as OCRExtractedData;

      // Validate the extracted data
      if (!extractedData.headers || !Array.isArray(extractedData.headers) || extractedData.headers.length === 0) {
        return {
          success: false,
          error: "No column headers detected in the image",
        };
      }

      if (!extractedData.rows || !Array.isArray(extractedData.rows) || extractedData.rows.length === 0) {
        return {
          success: false,
          error: "No data rows detected in the image. Please ensure the image contains a clear calendar or schedule.",
        };
      }

      // Validate that rows match headers structure
      const hasDateColumn = extractedData.headers.some((h) => h.toLowerCase().includes("date"));
      if (!hasDateColumn) {
        return {
          success: false,
          error: "No date column detected. A date column is required for import.",
        };
      }

      return {
        success: true,
        data: extractedData,
      };
    } catch (error) {
      console.error("Calendar OCR error:", error);

      if (error instanceof Error) {
        // Handle specific OpenAI API errors
        if (error.message.includes("API key")) {
          return {
            success: false,
            error: "OpenAI API key is not configured properly",
          };
        }
        if (error.message.includes("rate limit")) {
          return {
            success: false,
            error: "Rate limit reached. Please try again in a few moments.",
          };
        }
        if (error.message.includes("quota")) {
          return {
            success: false,
            error: "API quota exceeded. Please contact support.",
          };
        }

        return {
          success: false,
          error: `OCR extraction failed: ${error.message}`,
        };
      }

      return {
        success: false,
        error: "An unexpected error occurred during OCR processing",
      };
    }
  }

  /**
   * Validate that the extracted data is suitable for game import
   * @param data - OCRExtractedData to validate
   * @returns Validation result with any warnings
   */
  validateExtractedData(data: OCRExtractedData): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    // Check for date column
    const dateColumnIndex = data.headers.findIndex((h) => h.toLowerCase().includes("date"));
    if (dateColumnIndex === -1) {
      return { valid: false, warnings: ["Date column is required"] };
    }

    // Check date format in rows
    const dateColumn = data.headers[dateColumnIndex];
    data.rows.forEach((row, index) => {
      const dateValue = row[dateColumn];
      if (!dateValue) {
        warnings.push(`Row ${index + 1}: Missing date value`);
        return;
      }

      // Validate date format (should be YYYY-MM-DD or parseable)
      const date = new Date(String(dateValue));
      if (isNaN(date.getTime())) {
        warnings.push(`Row ${index + 1}: Invalid date format "${dateValue}"`);
      }
    });

    return { valid: true, warnings };
  }
}

export const calendarOCRService = new CalendarOCRService();
