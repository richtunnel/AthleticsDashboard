"use server";

import { prisma } from "@/lib/database/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/utils/authOptions";
import { travelAIService } from "@/lib/services/travelAI";

export async function generateRecommendation(gameId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: {
          organizationId: user.organizationId,
        },
      },
    });

    if (!game) {
      return { success: false, error: "Game not found or unauthorized" };
    }

    const recommendation = await travelAIService.createTravelRecommendation(gameId, user.organizationId);

    return {
      success: true,
      data: recommendation,
    };
  } catch (error: any) {
    console.error("Error generating recommendation:", error);
    return {
      success: false,
      error: error.message || "Failed to generate recommendation",
    };
  }
}

export async function generateBatchRecommendations(gameIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const results = await travelAIService.batchGenerateRecommendations(gameIds, user.organizationId);

    const successfulRecommendations = await Promise.all(
      results
        .filter((r) => r.recommendation !== null)
        .map(async (r) => {
          if (!r.recommendation) return null;
          return travelAIService.createTravelRecommendation(r.gameId, user.organizationId);
        })
    );

    return {
      success: true,
      data: {
        total: gameIds.length,
        successful: successfulRecommendations.filter((r) => r !== null).length,
        failed: results.filter((r) => r.recommendation === null).length,
        recommendations: successfulRecommendations.filter((r) => r !== null),
      },
    };
  } catch (error: any) {
    console.error("Error generating batch recommendations:", error);
    return {
      success: false,
      error: error.message || "Failed to generate recommendations",
    };
  }
}

export async function addRecommendationToGame(gameId: string, recommendationId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: {
          organizationId: user.organizationId,
        },
      },
    });

    if (!game) {
      return { success: false, error: "Game not found or unauthorized" };
    }

    await travelAIService.addRecommendationToGame(gameId, recommendationId);

    return { success: true };
  } catch (error: any) {
    console.error("Error adding recommendation to game:", error);
    return {
      success: false,
      error: error.message || "Failed to add recommendation",
    };
  }
}

export async function undoRecommendation(gameId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return { success: false, error: "Organization not found" };
    }

    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        homeTeam: {
          organizationId: user.organizationId,
        },
      },
    });

    if (!game) {
      return { success: false, error: "Game not found or unauthorized" };
    }

    await travelAIService.undoRecommendation(gameId);

    return { success: true };
  } catch (error: any) {
    console.error("Error undoing recommendation:", error);
    return {
      success: false,
      error: error.message || "Failed to undo recommendation",
    };
  }
}

export async function toggleAutoFill(enabled: boolean) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return { success: false, error: "Organization not found" };
    }

    await prisma.travelSettings.upsert({
      where: { organizationId: user.organizationId },
      update: {
        autoFillEnabled: enabled,
      },
      create: {
        organizationId: user.organizationId,
        autoFillEnabled: enabled,
      },
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error toggling auto-fill:", error);
    return {
      success: false,
      error: error.message || "Failed to toggle auto-fill",
    };
  }
}

export async function cleanupExpiredRecommendations() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const count = await travelAIService.cleanupExpiredRecommendations();
    return { success: true, data: { count } };
  } catch (error: any) {
    console.error("Error cleaning up recommendations:", error);
    return {
      success: false,
      error: error.message || "Failed to cleanup recommendations",
    };
  }
}
