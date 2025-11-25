import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";
import { TeamLevel, GameStatus } from "../../../../../../types/main.types";

interface ImportGameData {
  date: string;
  time?: string | null;
  sport?: string;
  level?: string;
  opponent?: string | null;
  away?: string | null; // Away column for smart detection
  home?: string | null; // Home column for smart detection
  isHome: boolean | null;
  location?: string | null; // CSV uses "location" field
  venue?: string | null; // Also support "venue" field
  status?: string;
  busTravel?: boolean | null;
  notes?: string | null;
}

// Helper function to normalize level strings to enum
function normalizeLevel(level: string): TeamLevel {
  const normalized = level.toUpperCase().trim();

  const levelMap: { [key: string]: TeamLevel } = {
    VARSITY: "VARSITY",
    V: "VARSITY",
    VAR: "VARSITY",
    JV: "JV",
    "JUNIOR VARSITY": "JV",
    FRESHMAN: "FRESHMAN",
    FROSH: "FRESHMAN",
    F: "FRESHMAN",
    "MIDDLE SCHOOL": "MIDDLE_SCHOOL",
    MS: "MIDDLE_SCHOOL",
    MIDDLE: "MIDDLE_SCHOOL",
    YOUTH: "YOUTH",
    Y: "YOUTH",
  };

  return levelMap[normalized] || "VARSITY"; // Default to VARSITY if not found
}

// Helper function to normalize status strings to enum
function normalizeStatus(status?: string): GameStatus {
  if (!status) return "SCHEDULED";

  const normalized = status.toUpperCase().trim();

  const statusMap: { [key: string]: GameStatus } = {
    SCHEDULED: "SCHEDULED",
    CONFIRMED: "CONFIRMED",
    POSTPONED: "POSTPONED",
    CANCELLED: "CANCELLED",
    CANCELED: "CANCELLED",
    COMPLETED: "COMPLETED",
    COMPLETE: "COMPLETED",
    FINISHED: "COMPLETED",
  };

  return statusMap[normalized] || "SCHEDULED";
}

// Helper function to validate date string
function validateAndParseDate(dateString: string): Date {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateString}`);
  }
  return date;
}

// Helper function to validate time string (HH:MM format)
function validateTime(timeString: string | null | undefined): string | null {
  if (!timeString) return null;
  
  const trimmed = String(timeString).trim();
  if (!trimmed) return null;
  
  // Validate HH:MM format
  const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (!timePattern.test(trimmed)) {
    throw new Error(`Invalid time format: ${trimmed}. Expected HH:MM format`);
  }
  
  return trimmed;
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { games } = await request.json();

    if (!games || !Array.isArray(games)) {
      return NextResponse.json({ success: false, error: "Invalid games data" }, { status: 400 });
    }

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const warnings: string[] = [];
    const createdGameIds: string[] = [];

    // Fetch user's school/team name for Home/Away detection
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organization: true,
      },
    });

    const userSchoolNames = [
      user?.schoolName,
      user?.teamName,
      user?.organization?.name,
    ].filter(Boolean).map(name => name!.toLowerCase().trim());

    // Create a cache for entities to avoid duplicate database queries
    type Sport = { id: string; name: string; season: string };
    type Team = { id: string; name: string; sportId: string; level: TeamLevel; organizationId: string };
    type Opponent = { id: string; name: string; organizationId: string };
    type Venue = { id: string; name: string; organizationId: string };
    
    const entityCache = {
      sports: new Map<string, Sport>(),
      teams: new Map<string, Team>(),
      opponents: new Map<string, Opponent>(),
      venues: new Map<string, Venue>(),
    };

    // Process each game with comprehensive validation
    for (let i = 0; i < games.length; i++) {
      const gameData = games[i] as ImportGameData;
      const rowNum = i + 1;

      try {
        // === STEP 1: VALIDATE REQUIRED FIELDS ===
        if (!gameData.date) {
          errors.push(`Row ${rowNum}: Missing required field (date)`);
          failedCount++;
          continue;
        }

        // Validate and parse date
        let parsedDate: Date;
        try {
          parsedDate = validateAndParseDate(gameData.date);
        } catch (dateError) {
          errors.push(`Row ${rowNum}: ${dateError instanceof Error ? dateError.message : 'Invalid date'}`);
          failedCount++;
          continue;
        }

        // Validate time if provided
        let validatedTime: string | null = null;
        try {
          validatedTime = validateTime(gameData.time);
        } catch (timeError) {
          errors.push(`Row ${rowNum}: ${timeError instanceof Error ? timeError.message : 'Invalid time'}`);
          failedCount++;
          continue;
        }

        // === STEP 2: PREPARE DATA WITH DEFAULTS ===
        const sportName = gameData.sport?.trim() || "Unknown Sport";
        const levelValue = gameData.level?.trim() || "VARSITY";
        const opponentName = gameData.opponent?.trim() || null;
        const awayColumnValue = gameData.away?.trim() || null;
        const homeColumnValue = gameData.home?.trim() || null;
        // Use location or venue field (location takes precedence for CSV imports)
        const venueName = (gameData.location?.trim() || gameData.venue?.trim()) || null;
        const normalizedLevel = normalizeLevel(levelValue);
        const normalizedStatus = normalizeStatus(gameData.status);
        
        // === SMART HOME/AWAY DETECTION ===
        let isHome: boolean | null = gameData.isHome !== null && gameData.isHome !== undefined ? gameData.isHome : null;
        
        // Only perform auto-detection if isHome is not explicitly set
        if (isHome === null && userSchoolNames.length > 0) {
          let isAwayByColumn = false;
          let isHomeByColumn = false;
          let isHomeByLocation = false;
          
          // Check Away column
          if (awayColumnValue) {
            const awayValueLower = awayColumnValue.toLowerCase().trim();
            isAwayByColumn = userSchoolNames.some(schoolName => 
              awayValueLower.includes(schoolName)
            );
          }
          
          // Check Home column
          if (homeColumnValue) {
            const homeValueLower = homeColumnValue.toLowerCase().trim();
            isHomeByColumn = userSchoolNames.some(schoolName => 
              homeValueLower.includes(schoolName)
            );
          }
          
          // Check Location column
          if (venueName) {
            const locationValueLower = venueName.toLowerCase().trim();
            isHomeByLocation = userSchoolNames.some(schoolName => 
              locationValueLower.includes(schoolName)
            );
          }
          
          // Apply detection logic
          if (isAwayByColumn && (isHomeByColumn || isHomeByLocation)) {
            warnings.push(
              `Row ${rowNum}: Conflict detected - your team appears in both Away and Home/Location columns. Defaulting to Away.`
            );
            isHome = false;
          } else if (isAwayByColumn) {
            // User's school is in Away column → game is AWAY
            isHome = false;
          } else if (isHomeByColumn || isHomeByLocation) {
            // User's school is in Home or Location column → game is HOME
            isHome = true;
          }
        }
        
        // If still not determined, default to HOME as fallback (pending state)
        if (isHome === null) {
          isHome = true; // Default to HOME when unable to determine from data
        }

        // === STEP 3: FIND OR CREATE SPORT ===
        let sport;
        const sportCacheKey = sportName.toLowerCase();
        
        if (entityCache.sports.has(sportCacheKey)) {
          sport = entityCache.sports.get(sportCacheKey);
        } else {
          sport = await prisma.sport.findFirst({
            where: {
              name: {
                equals: sportName,
                mode: "insensitive",
              },
            },
          });

          if (!sport) {
            sport = await prisma.sport.create({
              data: {
                name: sportName,
                season: "FALL", // Default season
              },
            });
          }
          
          entityCache.sports.set(sportCacheKey, sport);
        }

        if (!sport || !sport.id) {
          errors.push(`Row ${rowNum}: Failed to create or find sport "${sportName}"`);
          failedCount++;
          continue;
        }

        // === STEP 4: FIND OR CREATE TEAM ===
        let team;
        const teamCacheKey = `${sport.id}-${normalizedLevel}`;
        
        if (entityCache.teams.has(teamCacheKey)) {
          team = entityCache.teams.get(teamCacheKey);
        } else {
          team = await prisma.team.findFirst({
            where: {
              sportId: sport.id,
              level: normalizedLevel,
              organizationId: session.user.organizationId,
            },
          });

          if (!team) {
            team = await prisma.team.create({
              data: {
                name: `${sportName} ${normalizedLevel}`,
                sportId: sport.id,
                level: normalizedLevel,
                organizationId: session.user.organizationId,
              },
            });
          }
          
          entityCache.teams.set(teamCacheKey, team);
        }

        if (!team || !team.id) {
          errors.push(`Row ${rowNum}: Failed to create or find team for "${sportName} ${normalizedLevel}"`);
          failedCount++;
          continue;
        }

        // === STEP 5: CHECK FOR DUPLICATE GAME ===
        const duplicateQuery: {
          date: Date;
          homeTeamId: string;
          isHome: boolean;
          time?: string | null;
          opponentId?: string | null;
        } = {
          date: parsedDate,
          homeTeamId: team.id,
          isHome: isHome,
        };

        // Add time to duplicate check (both null or both same value)
        if (validatedTime) {
          duplicateQuery.time = validatedTime;
        } else {
          duplicateQuery.time = null;
        }

        // Find opponent first if provided
        let existingOpponent = null;
        if (opponentName) {
          const opponentCacheKey = opponentName.toLowerCase();
          
          if (entityCache.opponents.has(opponentCacheKey)) {
            existingOpponent = entityCache.opponents.get(opponentCacheKey);
          } else {
            existingOpponent = await prisma.opponent.findFirst({
              where: {
                name: {
                  equals: opponentName,
                  mode: "insensitive",
                },
                organizationId: session.user.organizationId,
              },
            });
            
            if (existingOpponent) {
              entityCache.opponents.set(opponentCacheKey, existingOpponent);
            }
          }
          
          if (existingOpponent) {
            duplicateQuery.opponentId = existingOpponent.id;
          }
        } else {
          duplicateQuery.opponentId = null;
        }

        // Check for existing game with exact match
        const duplicateGame = await prisma.game.findFirst({
          where: duplicateQuery,
          include: {
            homeTeam: {
              include: {
                sport: true,
              },
            },
            opponent: true,
          },
        });

        if (duplicateGame) {
          const duplicateDate = new Date(duplicateGame.date).toLocaleDateString();
          const duplicateTime = duplicateGame.time || "no time";
          const duplicateOpponent = duplicateGame.opponent?.name || "no opponent";
          const duplicateLocation = duplicateGame.isHome ? "Home" : "Away";
          
          errors.push(
            `Row ${rowNum}: Duplicate game already exists (${duplicateGame.homeTeam.sport.name} ${duplicateGame.homeTeam.level} vs ${duplicateOpponent} on ${duplicateDate} at ${duplicateTime}, ${duplicateLocation})`
          );
          failedCount++;
          continue;
        }

        // === STEP 6: FIND OR CREATE OPPONENT ===
        let opponentId: string | null = null;
        if (opponentName) {
          let opponent = existingOpponent; // Use the one we found during duplicate check
          
          if (!opponent) {
            const opponentCacheKey = opponentName.toLowerCase();
            
            if (entityCache.opponents.has(opponentCacheKey)) {
              opponent = entityCache.opponents.get(opponentCacheKey);
            } else {
              opponent = await prisma.opponent.create({
                data: {
                  name: opponentName,
                  organizationId: session.user.organizationId,
                },
              });
              
              entityCache.opponents.set(opponentCacheKey, opponent);
            }
          }

          if (!opponent || !opponent.id) {
            errors.push(`Row ${rowNum}: Failed to create or find opponent "${opponentName}"`);
            failedCount++;
            continue;
          }

          opponentId = opponent.id;
        }

        // === STEP 7: FIND OR CREATE VENUE ===
        let venueId: string | null = null;
        if (venueName && !isHome) {
          let venue;
          const venueCacheKey = venueName.toLowerCase();
          
          if (entityCache.venues.has(venueCacheKey)) {
            venue = entityCache.venues.get(venueCacheKey);
          } else {
            venue = await prisma.venue.findFirst({
              where: {
                name: {
                  equals: venueName,
                  mode: "insensitive",
                },
                organizationId: session.user.organizationId,
              },
            });

            if (!venue) {
              venue = await prisma.venue.create({
                data: {
                  name: venueName,
                  organizationId: session.user.organizationId,
                },
              });
            }
            
            entityCache.venues.set(venueCacheKey, venue);
          }

          if (!venue || !venue.id) {
            errors.push(`Row ${rowNum}: Failed to create or find venue "${venueName}"`);
            failedCount++;
            continue;
          }

          venueId = venue.id;
        }

        // === STEP 8: CREATE GAME WITH VALIDATION ===
        const gameCreateData = {
          date: parsedDate,
          time: validatedTime,
          homeTeamId: team.id,
          opponentId,
          venueId,
          isHome,
          status: normalizedStatus,
          busTravel: gameData.busTravel || false,
          notes: gameData.notes?.trim() || null,
          location: isHome ? null : (gameData.location?.trim() || null), // Store raw location for away games
          createdById: session.user.id,
          sortOrder: 0, // Default sort order
        };

        // Validate that all required IDs exist
        if (!gameCreateData.homeTeamId) {
          errors.push(`Row ${rowNum}: Missing homeTeamId - cannot create game`);
          failedCount++;
          continue;
        }

        const createdGame = await prisma.game.create({
          data: gameCreateData,
          include: {
            homeTeam: {
              include: {
                sport: true,
              },
            },
            opponent: true,
            venue: true,
          },
        });

        // === STEP 9: VALIDATE CREATED GAME ===
        if (!createdGame || !createdGame.id) {
          errors.push(`Row ${rowNum}: Game creation failed - no ID returned`);
          failedCount++;
          continue;
        }

        // Verify the game can be queried back (ensures DB consistency)
        const verifyGame = await prisma.game.findUnique({
          where: { id: createdGame.id },
          include: {
            homeTeam: {
              include: {
                sport: true,
                organization: true,
              },
            },
            opponent: true,
            venue: true,
          },
        });

        if (!verifyGame) {
          errors.push(`Row ${rowNum}: Game created but cannot be queried - potential data corruption`);
          failedCount++;
          // Try to clean up the corrupted game
          try {
            await prisma.game.delete({ where: { id: createdGame.id } });
          } catch (cleanupError) {
            console.error(`Failed to clean up corrupted game ${createdGame.id}:`, cleanupError);
          }
          continue;
        }

        // Verify all required relations are populated
        if (!verifyGame.homeTeam || !verifyGame.homeTeam.sport) {
          errors.push(`Row ${rowNum}: Game created with incomplete relations - homeTeam or sport missing`);
          failedCount++;
          // Clean up corrupted game
          try {
            await prisma.game.delete({ where: { id: createdGame.id } });
          } catch (cleanupError) {
            console.error(`Failed to clean up corrupted game ${createdGame.id}:`, cleanupError);
          }
          continue;
        }

        // === SUCCESS ===
        createdGameIds.push(createdGame.id);
        successCount++;

      } catch (error) {
        console.error(`Row ${rowNum} import error:`, error);
        errors.push(`Row ${rowNum}: ${error instanceof Error ? error.message : "Unknown error"}`);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        success: successCount,
        failed: failedCount,
        errors,
        warnings,
        createdGameIds,
      },
    });
  } catch (error) {
    console.error("Batch import error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to import games",
      },
      { status: 500 }
    );
  }
}
