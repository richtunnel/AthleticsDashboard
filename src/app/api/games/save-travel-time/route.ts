import { requireAuth } from "@/lib/utils/auth";
import { prisma } from "@/lib/database/prisma";

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const { gameId, departureTime, address } = await request.json();

    // Validate inputs
    if (!gameId || !departureTime || !address) {
      return new Response(
        JSON.stringify({ error: "Game ID, departure time, and address are required" }),
        { status: 400 }
      );
    }

    // Fetch game to verify ownership
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: { organizationId: session.user.organizationId },
      },
      include: {
        homeTeam: true,
      },
    });

    if (!game) {
      return new Response(JSON.stringify({ error: "Game not found" }), { status: 404 });
    }

    // Check if "Travel Time" custom column exists (case-insensitive)
    const travelTimeColumn = await prisma.customColumn.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: {
          mode: 'insensitive',
          equals: 'Travel Time',
        },
      },
    });

    if (!travelTimeColumn) {
      return new Response(
        JSON.stringify({ error: "Travel Time column not found. Please enable Enhanced Travel Times in settings." }),
        { status: 400 }
      );
    }

    // Check if "Address" custom column exists (case-insensitive)
    let addressColumn = await prisma.customColumn.findFirst({
      where: {
        organizationId: session.user.organizationId,
        name: {
          mode: 'insensitive',
          equals: 'Address',
        },
      },
    });

    // If Address column doesn't exist, create it
    if (!addressColumn) {
      addressColumn = await prisma.customColumn.create({
        data: {
          name: "Address",
          type: "TEXT",
          organizationId: session.user.organizationId,
        },
      });
    }

    // Update game with travel time and address
    const currentCustomData = (game.customData as any) || {};
    const updatedCustomData = {
      ...currentCustomData,
      [travelTimeColumn.id]: departureTime,
      [addressColumn.id]: address,
    };

    await prisma.game.update({
      where: { id: gameId },
      data: {
        customData: updatedCustomData,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          travelTimeColumnId: travelTimeColumn.id,
          addressColumnId: addressColumn.id,
          addressColumnCreated: !addressColumn,
        },
      }),
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Save travel time error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to save travel time" }),
      { status: 500 }
    );
  }
}
