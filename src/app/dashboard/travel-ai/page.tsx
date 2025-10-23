"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Box, Paper, Typography, Stack, Button, CircularProgress, Alert, Divider } from "@mui/material";
import { AutoFillToggle } from "@/components/travel/AutoFillToggle";
import { RecommendationCard } from "@/components/travel/RecommendationCard";
import { generateRecommendation, addRecommendationToGame, undoRecommendation, cleanupExpiredRecommendations } from "./actions";
import { Refresh } from "@mui/icons-material";

interface Game {
  id: string;
  date: string;
  time: string | null;
  isHome: boolean;
  busTravel: boolean;
  travelRequired: boolean;
  homeTeam: {
    name: string;
    level: string;
    sport: {
      name: string;
    };
  };
  opponent?: {
    name: string;
  };
  venue?: {
    name: string;
    city?: string;
    state?: string;
  };
}

export default function TravelAIPage() {
  const queryClient = useQueryClient();
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const {
    data: gamesResponse,
    isLoading: gamesLoading,
    error: gamesError,
  } = useQuery({
    queryKey: ["travel-ai-games"],
    queryFn: async () => {
      const res = await fetch("/api/games?travelRequired=true&limit=100");
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  const {
    data: recommendationsResponse,
    isLoading: recommendationsLoading,
    error: recommendationsError,
  } = useQuery({
    queryKey: ["travel-recommendations"],
    queryFn: async () => {
      const res = await fetch("/api/travel-recommendations");
      if (!res.ok) throw new Error("Failed to fetch recommendations");
      return res.json();
    },
  });

  const { data: settingsResponse, isLoading: settingsLoading } = useQuery({
    queryKey: ["travel-settings"],
    queryFn: async () => {
      const res = await fetch("/api/travel-settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });

  const generateRecommendationMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const result = await generateRecommendation(gameId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-recommendations"] });
    },
  });

  const addToGameMutation = useMutation({
    mutationFn: async ({ gameId, recommendationId }: { gameId: string; recommendationId: string }) => {
      const result = await addRecommendationToGame(gameId, recommendationId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });

  const undoMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const result = await undoRecommendation(gameId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["travel-recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });

  const handleGenerateAll = async () => {
    setIsGeneratingAll(true);
    setGenerationError(null); // Clear previous errors
    const errors: string[] = [];

    try {
      const games = gamesResponse?.data?.games || [];
      const recommendations: any[] = recommendationsResponse?.data || [];

      const gamesNeedingRecommendations = games.filter((game: Game) => {
        return !recommendations.some((rec: any) => rec.gameId === game.id && !rec.addedToGame);
      });

      for (const game of gamesNeedingRecommendations) {
        try {
          // Use the mutation and wait for it to complete
          await generateRecommendationMutation.mutateAsync(game.id);
        } catch (error: any) {
          // Catch individual generation errors
          console.error(`Failed to generate recommendation for game ${game.id}:`, error);
          errors.push(error.message || `Generation failed for a game.`);
        }
      }

      if (errors.length > 0) {
        // Consolidate and set the error message
        setGenerationError(`Batch generation completed with ${errors.length} error(s). (e.g., ${errors[0]})`);
      }
    } catch (error) {
      // Catch fatal errors outside the loop (e.g., gamesResponse failure)
      setGenerationError("A critical error occurred during batch setup.");
      console.error("Critical error during batch generation:", error);
    } finally {
      setIsGeneratingAll(false);
      // Ensure data is refetched even if errors occurred in the loop
      queryClient.invalidateQueries({ queryKey: ["travel-recommendations"] });
    }
  };

  const handleCleanup = async () => {
    try {
      const result = await cleanupExpiredRecommendations();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["travel-recommendations"] });
      }
    } catch (error) {
      console.error("Failed to cleanup recommendations:", error);
    }
  };

  useEffect(() => {
    const interval = setInterval(
      () => {
        handleCleanup();
      },
      5 * 60 * 1000
    );

    return () => clearInterval(interval);
  }, []);

  const games = gamesResponse?.data?.games || [];
  const recommendations = recommendationsResponse?.data || [];
  const settings = settingsResponse?.data;

  const gamesWithRecommendations = games
    .map((game: Game) => {
      const recommendation = recommendations.find((rec: any) => rec.gameId === game.id);
      return recommendation ? { game, recommendation } : null;
    })
    .filter(Boolean);

  if (gamesLoading || recommendationsLoading || settingsLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // TODO: Enable in production

  // if (gamesError || recommendationsError) {
  //   return (
  //     <Box sx={{ p: 3 }}>
  //       <Alert severity="error">Failed to load Travel AI data</Alert>
  //     </Box>
  //   );
  // }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        Travel AI Recommendations
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Generate AI-powered bus departure and arrival times based on real-time traffic and weather conditions.
      </Typography>

      <Stack spacing={3}>
        <AutoFillToggle initialValue={settings?.autoFillEnabled || false} />

        <Divider />
        {generationError && (
          <Alert severity="error" onClose={() => setGenerationError(null)} sx={{ mb: 2 }}>
            {generationError}
          </Alert>
        )}
        <Paper elevation={2} sx={{ p: 3 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Recommendations</Typography>
            <Stack direction="row" spacing={2}>
              <Button variant="outlined" startIcon={<Refresh />} onClick={handleCleanup}>
                Cleanup Expired
              </Button>
              <Button variant="contained" onClick={handleGenerateAll} disabled={isGeneratingAll}>
                {isGeneratingAll ? "Generating..." : "Generate All"}
              </Button>
            </Stack>
          </Stack>

          {gamesWithRecommendations.length === 0 ? (
            <Alert severity="info">No recommendations available. Click "Generate All" to create recommendations for games with travel requirements.</Alert>
          ) : (
            <Stack spacing={2}>
              {gamesWithRecommendations.map((item: any) => (
                <RecommendationCard
                  key={item.recommendation.id}
                  game={item.game}
                  recommendation={item.recommendation}
                  onAdd={async (gameId, recommendationId) => {
                    await addToGameMutation.mutateAsync({ gameId, recommendationId });
                  }}
                  onUndo={async (gameId) => {
                    await undoMutation.mutateAsync(gameId);
                  }}
                />
              ))}
            </Stack>
          )}

          {games.length > 0 && gamesWithRecommendations.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Found {games.length} game(s) with travel requirements. Generate recommendations to see them here.
            </Alert>
          )}
        </Paper>
      </Stack>
    </Box>
  );
}
