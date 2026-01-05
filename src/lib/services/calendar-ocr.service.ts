import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export interface CalendarOCRSettings {
  maxFileSize: number; // 200KB
  supportedFormats: string[]; // ['image/jpeg', 'image/png', 'image/webp']
}

export interface ExtractedGameData {
  date?: string;
  time?: string;
  sport?: string;
  opponent?: string;
  location?: string;
  homeAway?: string;
  level?: string;
  notes?: string;
  confidence: number;
  rawText?: string;
}

export interface OCRExtractionResult {
  success: boolean;
  data: ExtractedGameData[];
  metadata: {
    totalGames: number;
    processingTime: number;
    imageQuality: 'excellent' | 'good' | 'fair' | 'poor';
    handwritingLegibility: 'excellent' | 'good' | 'fair' | 'poor';
    suggestions: string[];
  };
  errors: string[];
}

export class CalendarOCRService {
  private readonly settings: CalendarOCRSettings = {
    maxFileSize: 200 * 1024, // 200KB in bytes
    supportedFormats: ['image/jpeg', 'image/png', 'image/webp'],
  };

  async extractGamesFromImage(imageBuffer: Buffer, fileName: string): Promise<OCRExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Validate image
      const validationResult = this.validateImage(imageBuffer, fileName);
      if (!validationResult.valid) {
        return {
          success: false,
          data: [],
          metadata: {
            totalGames: 0,
            processingTime: Date.now() - startTime,
            imageQuality: 'poor',
            handwritingLegibility: 'poor',
            suggestions: validationResult.errors,
          },
          errors: validationResult.errors,
        };
      }

      if (!openai) {
        return {
          success: false,
          data: [],
          metadata: {
            totalGames: 0,
            processingTime: Date.now() - startTime,
            imageQuality: 'good',
            handwritingLegibility: 'good',
            suggestions: ['OCR service unavailable - please use CSV import'],
          },
          errors: ['OpenAI API key not configured'],
        };
      }

      // Enhanced prompt for better handwriting recognition
      const enhancedPrompt = this.buildEnhancedPrompt();

      // Convert buffer to base64 for OpenAI
      const base64Image = imageBuffer.toString('base64');

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: enhancedPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1, // Lower temperature for more consistent results
          max_tokens: 2000,
        });

        const responseText = completion.choices[0]?.message?.content;
        if (!responseText) {
          throw new Error('No response from OCR service');
        }

        // Parse the JSON response
        const parsedResult = this.parseOCRResponse(responseText);
        
        return {
          success: true,
          data: parsedResult.data,
          metadata: {
            totalGames: parsedResult.data.length,
            processingTime: Date.now() - startTime,
            imageQuality: parsedResult.imageQuality,
            handwritingLegibility: parsedResult.handwritingLegibility,
            suggestions: parsedResult.suggestions,
          },
          errors: [],
        };
      } catch (apiError) {
        console.error('OpenAI API error:', apiError);
        
        return {
          success: false,
          data: [],
          metadata: {
            totalGames: 0,
            processingTime: Date.now() - startTime,
            imageQuality: 'good',
            handwritingLegibility: 'good',
            suggestions: [
              'OCR processing failed - try improving image quality',
              'Ensure good lighting and clear handwriting',
              'Consider converting to CSV for better accuracy',
            ],
          },
          errors: [`OCR processing failed: ${apiError instanceof Error ? apiError.message : 'Unknown error'}`],
        };
      }
    } catch (error) {
      console.error('Calendar OCR service error:', error);
      
      return {
        success: false,
        data: [],
        metadata: {
          totalGames: 0,
          processingTime: Date.now() - startTime,
          imageQuality: 'poor',
          handwritingLegibility: 'poor',
          suggestions: [
            'Image processing failed - try a different image format',
            'Ensure image is under 200KB in size',
            'Consider converting to CSV if OCR continues to fail',
          ],
        },
        errors: [`Processing error: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  private validateImage(imageBuffer: Buffer, fileName: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check file size
    if (imageBuffer.length > this.settings.maxFileSize) {
      errors.push(`File size (${this.formatFileSize(imageBuffer.length)}) exceeds maximum limit of ${this.formatFileSize(this.settings.maxFileSize)}`);
    }

    // Check file format
    const extension = fileName.toLowerCase().split('.').pop();
    const supportedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    
    if (!extension || !supportedExtensions.includes(extension)) {
      errors.push(`Unsupported file format. Please use: ${supportedExtensions.join(', ')}`);
    }

    // Basic image validation (minimum size check)
    if (imageBuffer.length < 1024) { // Less than 1KB is suspicious
      errors.push('Image file appears to be corrupted or too small');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  private buildEnhancedPrompt(): string {
    return `You are an expert OCR system specialized in reading handwritten sports schedules and calendar images. 

Your task is to extract game schedule information from calendar images with high accuracy, especially for handwriting.

INSTRUCTIONS:
1. Carefully examine the entire image for game schedule information
2. Look for dates, times, team names, opponents, locations, and any other game details
3. Pay special attention to handwriting - some text may be cursive, rushed, or unclear
4. Use context clues to help interpret unclear handwriting
5. Extract all possible game information, even if some fields are missing

COMMON SCHEDULE ELEMENTS TO LOOK FOR:
- Dates: Various formats (MM/DD, DD/MM, Month DD, "Jan 15", "1/15/24", etc.)
- Times: 24-hour or 12-hour format (15:00, 3:00 PM, 4pm, etc.)
- Sports: Basketball, Football, Soccer, Baseball, Volleyball, etc.
- Opponents/Teams: May be written in various styles
- Locations: Home, Away, Stadium names, school names
- Levels: Varsity, JV, Freshman, etc.
- Additional notes: Special events, bus travel, etc.

HANDWRITING TIPS:
- Letters may be unclear or connected
- Numbers might look like other numbers (1/7, 3/8, 0/6, etc.)
- Names might be abbreviated or use nicknames
- Date formats vary widely

OUTPUT FORMAT:
Return ONLY a valid JSON object in this exact format:

{
  "games": [
    {
      "date": "YYYY-MM-DD or original format if unclear",
      "time": "HH:MM or original format",
      "sport": "Sport name or null",
      "opponent": "Opponent/team name or null",
      "location": "Location or null",
      "homeAway": "Home/Away or null",
      "level": "Varsity/JV/etc or null",
      "notes": "Any additional notes or null",
      "confidence": 0.85
    }
  ],
  "imageQuality": "good",
  "handwritingLegibility": "fair",
  "suggestions": [
    "Any helpful suggestions for improving the extraction"
  ],
  "rawText": "Any text you found but couldn't interpret clearly"
}

CONFIDENCE SCALE:
- 0.9-1.0: Very clear and confident
- 0.7-0.9: Clear but with some uncertainty
- 0.5-0.7: Somewhat unclear, used context clues
- 0.3-0.5: Very unclear, best guess
- 0.0-0.3: Could not determine

QUALITY ASSESSMENT:
- imageQuality: excellent/good/fair/poor (based on image clarity, lighting, resolution)
- handwritingLegibility: excellent/good/fair/poor (based on handwriting clarity)

If you cannot find any game information, return an empty games array but still provide quality assessment.

Now analyze this image:`;
  }

  private parseOCRResponse(responseText: string): {
    data: ExtractedGameData[];
    imageQuality: 'excellent' | 'good' | 'fair' | 'poor';
    handwritingLegibility: 'excellent' | 'good' | 'fair' | 'poor';
    suggestions: string[];
  } {
    try {
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const games = parsed.games || [];
      
      // Validate and clean the data
      const cleanedGames = games
        .filter((game: any) => game && typeof game === 'object')
        .map((game: any) => ({
          date: game.date || undefined,
          time: game.time || undefined,
          sport: game.sport || undefined,
          opponent: game.opponent || undefined,
          location: game.location || undefined,
          homeAway: game.homeAway || undefined,
          level: game.level || undefined,
          notes: game.notes || undefined,
          confidence: Math.max(0, Math.min(1, game.confidence || 0.5)),
          rawText: game.rawText || undefined,
        }));

      return {
        data: cleanedGames,
        imageQuality: parsed.imageQuality || 'good',
        handwritingLegibility: parsed.handwritingLegibility || 'fair',
        suggestions: parsed.suggestions || [],
      };
    } catch (parseError) {
      console.error('Failed to parse OCR response:', parseError);
      
      return {
        data: [],
        imageQuality: 'poor',
        handwritingLegibility: 'poor',
        suggestions: [
          'Failed to parse OCR results - try with a clearer image',
          'Consider using CSV import for better accuracy',
        ],
      };
    }
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const calendarOCRService = new CalendarOCRService();