import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { sportComboLabel } from "@/lib/utils/formatGameDateTime";

/**
 * GET /api/schedule-board/schools
 *
 * Returns one card-entry per AD who has at least one active SchedulePost.
 * Each entry includes the school info and all their posted sport combos
 * (so the "View Schedule" modal can pre-populate the picker immediately
 *  without a second round-trip).
 *
 * Supports ?schoolId= to filter to a single school.
 */
export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const schoolId = request.nextUrl.searchParams.get("schoolId") || undefined;

  try {
    const posts = await prisma.schedulePost.findMany({
      where: {
        isActive: true,
        ...(schoolId ? { userId: schoolId } : {}),
      },
      include: {
        user: {
          select: {
            id:         true,
            name:       true,
            schoolName: true,
            teamName:   true,
            city:       true,
            organization: { select: { timezone: true } },
          },
        },
      },
      orderBy: { postedAt: "desc" },
    });

    // Group posts by userId
    const byUser = new Map<string, typeof posts>();
    for (const post of posts) {
      const uid = post.userId;
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(post);
    }

    const currentUserId = session.user.id;

    const schools = Array.from(byUser.values()).map((userPosts) => {
      const u = userPosts[0].user;
      return {
        userId:    u.id,
        name:      u.name,
        schoolName: u.schoolName,
        teamName:  u.teamName,
        city:      u.city,
        timezone:  u.organization?.timezone ?? "America/New_York",
        isOwnPost: u.id === currentUserId,
        combos: userPosts.map((p) => ({
          postId: p.id,
          sport:  p.sport,
          level:  p.level,
          gender: p.gender,
          label:  sportComboLabel(p.sport, p.level, p.gender),
          seasonStart: p.seasonStart.toISOString(),
          seasonEnd:   p.seasonEnd.toISOString(),
        })),
      };
    });

    return NextResponse.json({ schools });
  } catch (err) {
    console.error("[schedule-board/schools GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
