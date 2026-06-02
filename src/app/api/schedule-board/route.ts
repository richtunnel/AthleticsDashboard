import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { computeAvailableDates, deriveSeasonRange } from "@/lib/availability/computeAvailableDates";

export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const sport   = searchParams.get("sport")   || undefined;
  const level   = searchParams.get("level")   || undefined;
  const gender  = searchParams.get("gender")  || undefined;
  const schoolId = searchParams.get("schoolId") || undefined;
  const page    = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit   = 50;

  try {
    const where: any = { isActive: true };
    if (sport)    where.sport  = sport;
    if (level)    where.level  = level;
    if (gender)   where.gender = gender;
    if (schoolId) where.userId = schoolId;

    const [posts, total] = await prisma.$transaction([
      prisma.schedulePost.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              schoolName: true,
              teamName: true,
              city: true,
              organization: { select: { timezone: true } },
            },
          },
          workbook: { select: { id: true, name: true } },
        },
        orderBy: { postedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.schedulePost.count({ where }),
    ]);

    const currentUserId = session.user.id;

    const enriched = await Promise.all(
      posts.map(async (post) => {
        const availableDates = await computeAvailableDates(
          post.workbookId,
          post.sport,
          post.level,
          post.gender,
          {
            excludeWeekends: post.excludeWeekends,
            excludedDates:   (post.excludedDates as string[]) ?? [],
          }
        );

        return {
          id:          post.id,
          sport:       post.sport,
          level:       post.level,
          gender:      post.gender,
          seasonStart: post.seasonStart.toISOString(),
          seasonEnd:   post.seasonEnd.toISOString(),
          postedAt:    post.postedAt.toISOString(),
          timezone:    post.user.organization?.timezone ?? "America/New_York",
          isOwnPost:   post.userId === currentUserId,
          owner: {
            id:         post.user.id,
            name:       post.user.name,
            schoolName: post.user.schoolName,
            teamName:   post.user.teamName,
            city:       post.user.city,
          },
          availableDates: availableDates.map((d) => ({
            date:       d.dateISO,
            dayOfWeek:  d.dayOfWeek,
            timeWindow: d.timeWindow,
          })),
        };
      })
    );

    return NextResponse.json({ posts: enriched, total, page });
  } catch (err) {
    console.error("[schedule-board GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { workbookId, sport, level, gender, title, description } = body;

    if (!workbookId || !sport || !level || !gender) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify workbook belongs to this user
    const workbook = await prisma.gamesWorkbook.findFirst({
      where: { id: workbookId, userId: session.user.id },
    });
    if (!workbook) {
      return NextResponse.json({ error: "Workbook not found" }, { status: 404 });
    }

    // Auto-derive the season range from the workbook's actual game data
    const range = await deriveSeasonRange(workbookId, sport, level, gender);
    if (!range) {
      return NextResponse.json(
        { error: "No games found in this worksheet for the selected sport. Import your schedule first." },
        { status: 400 }
      );
    }

    // Upsert: one post per (user, sport, level, gender) combo
    const post = await prisma.schedulePost.upsert({
      where: { userId_sport_level_gender: { userId: session.user.id, sport, level, gender } },
      create: {
        userId:      session.user.id,
        workbookId,
        sport,
        level,
        gender,
        seasonStart: range.seasonStart,
        seasonEnd:   range.seasonEnd,
        isActive:    true,
        title:       title   ?? null,
        description: description ?? null,
      },
      update: {
        workbookId,
        seasonStart: range.seasonStart,
        seasonEnd:   range.seasonEnd,
        isActive:    true,
        ...(title       !== undefined && { title }),
        ...(description !== undefined && { description }),
        updatedAt:   new Date(),
      },
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (err) {
    console.error("[schedule-board POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
