import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/database/prisma";

/**
 * GET /api/calendar/feed/[token]
 * Returns an iCal feed of games for a specific parent/sport/level combination
 * 
 * The token is used to look up the parent and their subscribed calendars
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    
    if (!token || token.length < 8) {
      return new NextResponse("Invalid token", { status: 400 });
    }

    // For now, we'll implement a simpler approach:
    // The token will contain encoded information about what to fetch
    // In production, you'd store token mappings in the database
    
    // Decode the token (it's base64 encoded JSON with subscription info)
    let subscriptionInfo;
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      subscriptionInfo = JSON.parse(decoded);
    } catch {
      // Try URL-safe base64
      try {
        const decoded = Buffer.from(token.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
        subscriptionInfo = JSON.parse(decoded);
      } catch {
        return new NextResponse("Invalid token format", { status: 400 });
      }
    }

    const { userId, schoolId, sportName, level, expiration } = subscriptionInfo;

    // Check if token has expired
    if (expiration && new Date(expiration) < new Date()) {
      return new NextResponse("Token has expired", { status: 401 });
    }

    // Get the parent user
    const parentUser = await prisma.user.findFirst({
      where: { id: userId },
    });

    if (!parentUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Verify the parent has a link to this school/sport/level
    const parentLink = await prisma.parentAthleteLink.findFirst({
      where: {
        parentUserId: userId,
        schoolId: schoolId,
        sportName: { equals: sportName, mode: 'insensitive' },
        sportLevel: { contains: level, mode: 'insensitive' },
        active: true,
      },
    });

    if (!parentLink) {
      return new NextResponse("No subscription found for this calendar", { status: 403 });
    }

    // Find the team
    const teams = await prisma.team.findMany({
      where: {
        organizationId: schoolId,
        sport: {
          name: { equals: sportName, mode: 'insensitive' },
        },
        level: { equals: level, mode: 'insensitive' },
      },
      include: {
        sport: true,
        organization: true,
      },
    });

    if (teams.length === 0) {
      return generateEmptyICalFeed(sportName, level);
    }

    const team = teams[0];
    const teamIds = teams.map(t => t.id);

    // Get upcoming games (next 90 days by default)
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 90);

    const games = await prisma.game.findMany({
      where: {
        OR: [
          { homeTeamId: { in: teamIds } },
          { awayTeamId: { in: teamIds } },
        ],
        date: {
          gte: now,
          lte: endDate,
        },
        status: {
          in: ['SCHEDULED', 'CONFIRMED'],
        },
      },
      include: {
        homeTeam: {
          include: { sport: true },
        },
        awayTeam: true,
        opponent: true,
        venue: true,
      },
      orderBy: { date: 'asc' },
    });

    // Generate iCal feed
    const icalContent = generateICalFeed(
      games,
      sportName,
      level,
      team.organization.name,
      team.organization.timezone
    );

    return new NextResponse(icalContent, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `inline; filename="${sportName.toLowerCase().replace(/\s+/g, '-')}-${level.toLowerCase()}.ics"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error("[iCal Feed] Error generating feed:", error);
    return new NextResponse("Failed to generate calendar feed", { status: 500 });
  }
}

/**
 * Generate an empty iCal feed with just the VCALENDAR wrapper
 */
function generateEmptyICalFeed(sportName: string, level: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Opletics//${sportName} ${level}//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${sportName} - ${level} Games
X-WR-TIMEZONE:America/New_York
BEGIN:VTIMEZONE
TZID:America/New_York
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
END:DAYLIGHT
END:VTIMEZONE
END:VCALENDAR`;
}

/**
 * Generate iCal feed content from games
 */
function generateICalFeed(
  games: any[],
  sportName: string,
  level: string,
  schoolName: string,
  timezone: string = "America/New_York"
): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const calendarName = `${sportName} - ${level} - ${schoolName}`;
  
  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Opletics//${calendarName}//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
X-WR-CALNAME:${calendarName}
X-WR-TIMEZONE:${timezone}
BEGIN:VTIMEZONE
TZID:${timezone}
BEGIN:STANDARD
DTSTART:19701101T020000
RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU
TZOFFSETFROM:-0400
TZOFFSETTO:-0500
TZNAME:EST
END:STANDARD
BEGIN:DAYLIGHT
DTSTART:19700308T020000
RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU
TZOFFSETFROM:-0500
TZOFFSETTO:-0400
TZNAME:EDT
END:DAYLIGHT
END:VTIMEZONE
`;

  for (const game of games) {
    const eventUid = `${game.id}@opletics.com`;
    
    // Parse date and time
    const gameDate = new Date(game.date);
    let startDateTime: Date;
    let endDateTime: Date;
    
    if (game.time) {
      const [hours, minutes] = game.time.split(':').map(Number);
      startDateTime = new Date(gameDate);
      startDateTime.setHours(hours, minutes, 0, 0);
    } else {
      startDateTime = new Date(gameDate);
      startDateTime.setHours(12, 0, 0, 0);
    }
    
    // Default 2 hour duration
    endDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
    
    const formatICalDate = (date: Date): string => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    // Build location string
    let location = 'TBD';
    if (game.isHome) {
      location = 'Home';
    } else if (game.venue) {
      const parts = [game.venue.name, game.venue.address, game.venue.city, game.venue.state]
        .filter(p => p && p.trim());
      if (parts.length > 0) {
        location = parts.join(', ');
      }
    }
    
    // Build summary
    const opponentName = game.opponent?.name || game.awayTeam?.name || 'TBD';
    const separator = game.isHome ? ' vs ' : ' @ ';
    const summary = `${game.homeTeam?.name || sportName}${separator}${opponentName}`;
    
    // Build description
    const description = [
      `Sport: ${sportName}`,
      `Level: ${level}`,
      `Status: ${game.status}`,
      game.notes ? `\nNotes: ${game.notes}` : '',
    ].filter(Boolean).join('\n');
    
    ical += `BEGIN:VEVENT
UID:${eventUid}
DTSTAMP:${now}
DTSTART:${formatICalDate(startDateTime)}
DTEND:${formatICalDate(endDateTime)}
SUMMARY:${summary}
DESCRIPTION:${description.replace(/\n/g, '\\n')}
LOCATION:${location}
STATUS:${game.status === 'CONFIRMED' ? 'CONFIRMED' : 'TENTATIVE'}
END:VEVENT
`;
  }

  ical += 'END:VCALENDAR';
  
  return ical;
}
