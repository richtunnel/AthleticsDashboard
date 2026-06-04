import { NextRequest, NextResponse } from "next/server";
import { getAnySession } from "@/lib/utils/collaboratorSession";
import { prisma } from "@/lib/database/prisma";

const REQUESTER_SELECT = {
  id: true,
  name: true,
  email: true,
  schoolName: true,
  teamName: true,
  city: true,
  organization: { select: { timezone: true } },
};

function serializeRequest(req: any, currentUserId: string) {
  const isOwner = req.ownerUserId === currentUserId;
  return {
    id:                   req.id,
    schedulePostId:       req.schedulePostId,
    requesterUserId:      req.requesterUserId,
    ownerUserId:          req.ownerUserId,
    availableDate:        req.availableDate.toISOString(),
    availableTimeWindow:  req.availableTimeWindow,
    sport:                req.sport,
    level:                req.level,
    gender:               req.gender,
    isHomeForRequester:   req.isHomeForRequester,
    status:               req.status,
    confirmedByOwner:     req.confirmedByOwner,
    confirmedByRequester: req.confirmedByRequester,
    syncedGameId:         req.syncedGameId,
    readByOwner:          req.readByOwner,
    readByRequester:      req.readByRequester,
    createdAt:            req.createdAt.toISOString(),
    updatedAt:            req.updatedAt.toISOString(),
    timezone:             req.requester?.organization?.timezone ?? "America/New_York",
    requester: {
      id:         req.requester?.id,
      name:       req.requester?.name,
      email:      req.requester?.email,
      schoolName: req.requester?.schoolName,
      teamName:   req.requester?.teamName,
      city:       req.requester?.city,
      // Address only revealed after approval
      schoolAddress: ["APPROVED", "CONFIRMED", "CANCELLED"].includes(req.status)
        ? req.requester?.schoolAddress
        : undefined,
    },
    owner: {
      id:         req.owner?.id,
      name:       req.owner?.name,
      email:      req.owner?.email,
      schoolName: req.owner?.schoolName,
      teamName:   req.owner?.teamName,
    },
  };
}

export async function GET(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = request.nextUrl;
  const type   = searchParams.get("type");   // "received" | "sent" | null (= all)
  const status = searchParams.get("status"); // optional filter

  try {
    const where: any = {};
    if (type === "received") where.ownerUserId     = session.user.id;
    else if (type === "sent") where.requesterUserId = session.user.id;
    else where.OR = [{ ownerUserId: session.user.id }, { requesterUserId: session.user.id }];

    if (status) where.status = status;

    const requests = await prisma.gameRequest.findMany({
      where,
      include: {
        requester: {
          select: { ...REQUESTER_SELECT, schoolAddress: true },
        },
        owner: {
          select: REQUESTER_SELECT,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      requests: requests.map((r) => serializeRequest(r, session.user.id)),
    });
  } catch (err) {
    console.error("[game-requests GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAnySession();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const { schedulePostId, availableDate, isHomeForRequester } = body;

    if (!schedulePostId || !availableDate || typeof isHomeForRequester !== "boolean") {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const post = await prisma.schedulePost.findUnique({
      where: { id: schedulePostId },
      select: { userId: true, sport: true, level: true, gender: true, isActive: true },
    });

    if (!post || !post.isActive) {
      return NextResponse.json({ error: "Schedule post not found" }, { status: 404 });
    }

    if (post.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot request your own schedule" }, { status: 400 });
    }

    // Prevent duplicate requests — check + create in a serializable transaction
    // so two simultaneous requests for the same date can't both slip through.
    let gameRequest: any;
    try {
      gameRequest = await prisma.$transaction(async (tx) => {
        const existing = await tx.gameRequest.findFirst({
          where: {
            schedulePostId,
            requesterUserId: session.user.id,
            availableDate:   new Date(availableDate),
            status:          { in: ["PENDING", "APPROVED"] },
          },
        });
        if (existing) {
          const err: any = new Error("You already have an active request for this date");
          err.code = "DUPLICATE";
          throw err;
        }
        return tx.gameRequest.create({
          data: {
            schedulePostId,
            requesterUserId:    session.user.id,
            ownerUserId:        post.userId,
            availableDate:      new Date(availableDate),
            sport:              post.sport,
            level:              post.level,
            gender:             post.gender,
            isHomeForRequester,
          },
          include: {
            requester: { select: { ...REQUESTER_SELECT, schoolAddress: true } },
            owner:     { select: REQUESTER_SELECT },
          },
        });
      }, { isolationLevel: "Serializable" });
    } catch (err: any) {
      if (err.code === "DUPLICATE") {
        return NextResponse.json({ error: err.message }, { status: 409 });
      }
      throw err;
    }

    return NextResponse.json(
      { request: serializeRequest(gameRequest, session.user.id) },
      { status: 201 }
    );
  } catch (err) {
    console.error("[game-requests POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
