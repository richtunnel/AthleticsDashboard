"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, DollarSign, Clock } from "lucide-react";
import { AnalyticsData } from "../../../types/games";
import { Grid, Card, CardContent, Typography, Box } from "@mui/material";
import DashboardTitles from "./DashboardTitles";

export function DashboardStats() {
  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/games/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
  });

  if (isLoading) {
    return <div>Loading statistics...</div>;
  }

  const stats = [
    {
      name: "Upcoming Games",
      value: data?.upcomingGamesCount || 0,
      icon: Calendar,
      color: "bg-blue-500",
    },
    {
      name: "Travel Required",
      value: data?.travelStats?._count || 0,
      icon: MapPin,
      color: "bg-green-500",
    },
    {
      name: "Travel Cost",
      value: `$${(data?.travelStats?._sum?.travelCost || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "bg-yellow-500",
    },
    {
      name: "Travel Time",
      value: `${Math.round((data?.travelStats?._sum?.estimatedTravelTime || 0) / 60)}h`,
      icon: Clock,
      color: "bg-purple-500",
    },
  ];

  return (
    <div>
      {/* Stats Row with Responsive MUI Cards */}
      <DashboardTitles title="Analytics" subtitle="Here's what's happening with your schedule" />
      <Grid container spacing={3} sx={{ mb: 4, maxWidth: "991px" }}>
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={stat.name}>
              <Card sx={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <CardContent sx={{ textAlign: "center" }}>
                  <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                    <div className={`${stat.color} p-3 rounded-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  </Box>
                  <Typography variant="h5" component="div" sx={{ fontWeight: "bold", mb: 1 }}>
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stat.name}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Sports Breakdown */}
      {data?.sportStats && Object.keys(data.sportStats).length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold mb-4">Games by Sport</h3>
          <div className="space-y-3">
            {Object.entries(data.sportStats).map(([sport, count]) => {
              const maxCount = Math.max(...Object.values(data.sportStats || {}));
              const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;

              return (
                <div key={sport} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{sport}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
