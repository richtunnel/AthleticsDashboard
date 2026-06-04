import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";
import { sportComboLabel } from "@/lib/utils/formatGameDateTime";

const DEFAULT_LIMIT = 20;

/**
 * GET /api/schedule-board/schools
 *
 * Query params:
 *   schoolId  – filter to a single school (school search bar)
 *   district  – filter by district name (case-insensitive); "all" = no filter
 *   page      – 1-based page number (default 1)
 *   limit     – page size (default 20)
 *
 * Response includes:
 *   schools[]        – paginated school cards
 *   pagination       – total, page, totalPages, hasNext, hasPrev
 *   userDistrict     – the current user's schoolDistrict (may be null)
 *   availableDistricts – sorted unique district names from all active posts
 */
export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const schoolId       = searchParams.get("schoolId")  || undefined;
  const districtParam  = searchParams.get("district")  || undefined; // "all" or a name
  const page           = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit          = Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10));

  try {
    // Current user's district for default filtering and sort priority
    const currentUser = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { schoolDistrict: true },
    });
    const userDistrict = currentUser?.schoolDistrict ?? null;

    // --- If searching a specific school, bypass district/pagination logic ---
    if (schoolId) {
      const posts = await prisma.schedulePost.findMany({
        where:   { isActive: true, userId: schoolId },
        include: {
          user: {
            select: {
              id: true, name: true, schoolName: true, teamName: true,
              city: true, schoolDistrict: true,
              organization: { select: { timezone: true } },
            },
          },
        },
        orderBy: { postedAt: "desc" },
      });

      const byUser = groupByUser(posts, session.user.id);
      return NextResponse.json({
        schools:            byUser,
        pagination:         { total: byUser.length, page: 1, totalPages: 1, hasNext: false, hasPrev: false },
        userDistrict,
        availableDistricts: [],
      });
    }

    // --- District filter ---
    const useDistrict =
      districtParam && districtParam !== "all"
        ? districtParam
        : userDistrict; // default = user's own district (null = all)

    const districtWhere = useDistrict
      ? { schoolDistrict: { equals: useDistrict, mode: "insensitive" as const } }
      : {};

    // --- Get all unique users with active posts (for district-first ordering) ---
    // We fetch ID lists first so we can apply the "own-district first" sort without
    // pulling all user data upfront.
    const [ownDistrictIds, otherIds] = await Promise.all([
      // Users in the same district as the current user (sorted by school name)
      userDistrict
        ? prisma.user.findMany({
            where: {
              schedulePosts:  { some: { isActive: true } },
              schoolDistrict: { equals: userDistrict, mode: "insensitive" },
              ...districtWhere,
            },
            select:  { id: true },
            orderBy: { schoolName: "asc" },
          }).then((rows) => rows.map((r) => r.id))
        : Promise.resolve([] as string[]),

      // Everyone else matching the filter, sorted alphabetically
      prisma.user.findMany({
        where: {
          schedulePosts: { some: { isActive: true } },
          ...(userDistrict
            ? { NOT: { schoolDistrict: { equals: userDistrict, mode: "insensitive" } } }
            : {}),
          ...districtWhere,
        },
        select:  { id: true },
        orderBy: { schoolName: "asc" },
      }).then((rows) => rows.map((r) => r.id)),
    ]);

    const allSortedIds = [...new Set([...ownDistrictIds, ...otherIds])];
    const total        = allSortedIds.length;
    const totalPages   = Math.max(1, Math.ceil(total / limit));
    const safePage     = Math.min(page, totalPages);
    const pageIds      = allSortedIds.slice((safePage - 1) * limit, safePage * limit);

    if (pageIds.length === 0) {
      return NextResponse.json({
        schools:            [],
        pagination:         { total, page: safePage, totalPages, hasNext: false, hasPrev: safePage > 1 },
        userDistrict,
        availableDistricts: await getAvailableDistricts(),
      });
    }

    // Fetch full post data only for this page's users
    const posts = await prisma.schedulePost.findMany({
      where:   { isActive: true, userId: { in: pageIds } },
      include: {
        user: {
          select: {
            id: true, name: true, schoolName: true, teamName: true,
            city: true, schoolDistrict: true,
            organization: { select: { timezone: true } },
          },
        },
      },
    });

    // Preserve the district-first sort order
    const schoolMap = new Map<string, ReturnType<typeof buildSchoolEntry>>();
    for (const post of posts) {
      const uid = post.userId;
      if (!schoolMap.has(uid)) {
        schoolMap.set(uid, buildSchoolEntry(post, session.user.id));
      } else {
        schoolMap.get(uid)!.combos.push(buildCombo(post));
      }
    }

    const schools = pageIds
      .map((id) => schoolMap.get(id))
      .filter(Boolean) as ReturnType<typeof buildSchoolEntry>[];

    return NextResponse.json({
      schools,
      pagination: {
        total,
        page:       safePage,
        totalPages,
        hasNext:    safePage < totalPages,
        hasPrev:    safePage > 1,
      },
      userDistrict,
      availableDistricts: await getAvailableDistricts(),
    });
  } catch (err) {
    console.error("[schedule-board/schools GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── helpers ────────────────────────────────────────────────────────────────────

function buildCombo(post: any) {
  return {
    postId:      post.id,
    sport:       post.sport,
    level:       post.level,
    gender:      post.gender,
    label:       sportComboLabel(post.sport, post.level, post.gender),
    seasonStart: post.seasonStart.toISOString(),
    seasonEnd:   post.seasonEnd.toISOString(),
  };
}

function buildSchoolEntry(post: any, currentUserId: string) {
  const u = post.user;
  return {
    userId:       u.id,
    name:         u.name,
    schoolName:   u.schoolName,
    teamName:     u.teamName,
    city:         u.city,
    district:     u.schoolDistrict ?? null,
    timezone:     u.organization?.timezone ?? "America/New_York",
    isOwnPost:    u.id === currentUserId,
    combos:       [buildCombo(post)],
  };
}

function groupByUser(posts: any[], currentUserId: string) {
  const map = new Map<string, ReturnType<typeof buildSchoolEntry>>();
  for (const post of posts) {
    const uid = post.userId;
    if (!map.has(uid)) {
      map.set(uid, buildSchoolEntry(post, currentUserId));
    } else {
      map.get(uid)!.combos.push(buildCombo(post));
    }
  }
  return Array.from(map.values());
}

async function getAvailableDistricts(): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: {
      schedulePosts:  { some: { isActive: true } },
      schoolDistrict: { not: null },
    },
    select:   { schoolDistrict: true },
    distinct: ["schoolDistrict"],
    orderBy:  { schoolDistrict: "asc" },
  });
  return rows.map((r) => r.schoolDistrict!).filter(Boolean);
}
