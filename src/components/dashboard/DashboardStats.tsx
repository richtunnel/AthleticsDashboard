"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, DollarSign, Clock } from "lucide-react";
import { AnalyticsData } from "../../../types/games";

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
      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white rounded-lg border p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
              </div>
              <div className="text-2xl font-bold">{stat.value}</div>
              <div className="text-sm text-gray-600">{stat.name}</div>
            </div>
          );
        })}
      </div>

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
