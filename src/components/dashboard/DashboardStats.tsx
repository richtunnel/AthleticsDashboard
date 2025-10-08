"use client";

import { useQuery } from "@tanstack/react-query";
import { Calendar, MapPin, DollarSign, Clock } from "lucide-react";

export function DashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/games/analytics");
      if (!res.ok) throw new Error("Failed to fetch analytics");
      const result = await res.json();
      return result.data;
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
      value: data?.travelStats?.count || 0,
      icon: MapPin,
      color: "bg-green-500",
    },
    {
      name: "Travel Cost",
      value: `$${(data?.travelStats?.totalCost || 0).toLocaleString()}`,
      icon: DollarSign,
      color: "bg-yellow-500",
    },
    {
      name: "Travel Time",
      value: `${Math.round((data?.travelStats?.totalTime || 0) / 60)}h`,
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
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-4">Games by Sport</h3>
        <div className="space-y-3">
          {data?.sportStats &&
            Object.entries(data.sportStats).map(([sport, count]) => (
              <div key={sport} className="flex items-center justify-between">
                <span className="text-sm font-medium">{sport}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500"
                      style={{
                        width: `${(Number(count) / Math.max(...Object.values(data.sportStats).map(Number))) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
