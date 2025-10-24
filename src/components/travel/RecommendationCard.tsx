"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, Stack, Typography, Chip, IconButton, Tooltip, Button, Box } from "@mui/material";
import { DirectionsBus, Schedule, WbSunny, Traffic, LocationOn, CalendarMonth, Undo } from "@mui/icons-material";
import { format, formatDistance } from "date-fns";

interface Game {
  id: string;
  date: string;
  time: string | null;
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

interface RecommendationData {
  id: string;
  recommendedDeparture: string;
  recommendedArrival: string;
  travelDuration: number;
  trafficCondition: string;
  weatherCondition: string;
  addedToGame: boolean;
  addedAt?: string | null;
}

interface RecommendationCardProps {
  game: Game;
  recommendation: RecommendationData;
  onAdd: (gameId: string, recommendationId: string) => Promise<void>;
  onUndo: (gameId: string) => Promise<void>;
}

export function RecommendationCard({ game, recommendation, onAdd, onUndo }: RecommendationCardProps) {
  const [isAdded, setIsAdded] = useState(recommendation.addedToGame);
  const [isLoading, setIsLoading] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    setIsAdded(recommendation.addedToGame);
  }, [recommendation.addedToGame]);

  useEffect(() => {
    if (isAdded && recommendation.addedAt) {
      const interval = setInterval(() => {
        const addedTime = new Date(recommendation.addedAt!);
        const expiryTime = new Date(addedTime.getTime() + 30 * 60 * 1000);
        const now = new Date();

        if (now >= expiryTime) {
          setTimeRemaining("Expired");
          clearInterval(interval);
        } else {
          setTimeRemaining(formatDistance(expiryTime, now, { addSuffix: true }));
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isAdded, recommendation.addedAt]);

  const handleAdd = async () => {
    setIsLoading(true);
    try {
      await onAdd(game.id, recommendation.id);
      setIsAdded(true);
    } catch (error) {
      console.error("Failed to add recommendation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = async () => {
    setIsLoading(true);
    try {
      await onUndo(game.id);
      setIsAdded(false);
    } catch (error) {
      console.error("Failed to undo recommendation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTrafficColor = (condition: string) => {
    switch (condition.toLowerCase()) {
      case "light":
        return "success";
      case "moderate":
        return "warning";
      case "heavy":
        return "error";
      default:
        return "default";
    }
  };

  const departureTime = new Date(recommendation.recommendedDeparture);
  const arrivalTime = new Date(recommendation.recommendedArrival);
  const gameDate = new Date(game.date);

  return (
    <Card
      sx={{
        mb: 2,
        opacity: isAdded ? 0.6 : 1,
        transition: "all 0.3s ease",
        "&:hover": {
          boxShadow: isAdded ? 2 : 6,
          transform: isAdded ? "none" : "translateY(-2px)",
        },
        border: isAdded ? "2px solid" : "1px solid",
        borderColor: isAdded ? "success.main" : "divider",
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="h6" gutterBottom>
                {game.homeTeam.sport.name} - {game.opponent?.name || "TBD"}
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                <Chip label={game.homeTeam.level} size="small" />
                <Chip icon={<CalendarMonth />} label={format(gameDate, "MMM dd, yyyy")} size="small" variant="outlined" />
                {game.time && <Chip icon={<Schedule />} label={game.time} size="small" variant="outlined" />}
              </Stack>
              {game.venue && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <LocationOn fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">
                    {game.venue.name}
                    {game.venue.city && `, ${game.venue.city}`}
                    {game.venue.state && `, ${game.venue.state}`}
                  </Typography>
                </Stack>
              )}
            </Box>
            <Box>
              {isAdded ? (
                <Stack spacing={1} alignItems="flex-end">
                  <Chip label="Added" color="success" size="small" />
                  {timeRemaining && (
                    <Typography variant="caption" color="text.secondary">
                      Removes {timeRemaining}
                    </Typography>
                  )}
                  <Tooltip title="Undo add to spreadsheet">
                    <IconButton size="small" onClick={handleUndo} disabled={isLoading} color="primary">
                      <Undo />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : (
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleAdd}
                  disabled={isLoading}
                  sx={{
                    borderRadius: "20px",
                    px: 3,
                  }}
                >
                  Add to Spreadsheet
                </Button>
              )}
            </Box>
          </Stack>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            sx={{
              p: 2,
              bgcolor: "action.hover",
              borderRadius: 1,
            }}
          >
            <Stack flex={1} spacing={0.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <DirectionsBus color="primary" />
                <Typography variant="body2" fontWeight="bold">
                  Departure
                </Typography>
              </Stack>
              <Typography variant="h6">{format(departureTime, "h:mm a")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {format(departureTime, "MMM dd, yyyy")}
              </Typography>
            </Stack>

            <Stack flex={1} spacing={0.5}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Schedule color="primary" />
                <Typography variant="body2" fontWeight="bold">
                  Arrival
                </Typography>
              </Stack>
              <Typography variant="h6">{format(arrivalTime, "h:mm a")}</Typography>
              <Typography variant="caption" color="text.secondary">
                {recommendation.travelDuration} min travel time
              </Typography>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip icon={<Traffic />} label={`Traffic: ${recommendation.trafficCondition}`} size="small" color={getTrafficColor(recommendation.trafficCondition)} variant="outlined" />
            <Chip icon={<WbSunny />} label={recommendation.weatherCondition} size="small" variant="outlined" />
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
