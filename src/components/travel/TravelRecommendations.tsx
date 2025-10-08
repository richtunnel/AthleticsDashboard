"use client";

import { useQuery } from "@tanstack/react-query";
import { Clock, Bus, DollarSign, AlertCircle } from "lucide-react";

interface TravelRecommendationProps {
  gameId: string;
}

export function TravelRecommendation({ gameId }: TravelRecommendationProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["travel-recommendation", gameId],
    queryFn: async () => {
      const res = await fetch(`/api/ai/travel-recommendation/${gameId}`);
      if (!res.ok) throw new Error("Failed to fetch recommendation");
      const result = await res.json();
      return result.data;
    },
  });

  if (isLoading) {
    return <div className="animate-pulse bg-gray-100 rounded-lg p-4">Loading AI recommendation...</div>;
  }

  if (error || !data) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2 text-blue-800 font-semibold">
        <AlertCircle size={20} />
        AI Travel Recommendation
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock size={16} className="text-blue-600" />
          <div>
            <div className="font-medium">Travel Time</div>
            <div className="text-gray-600">{data.estimatedTravelTime} minutes</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock size={16} className="text-blue-600" />
          <div>
            <div className="font-medium">Departure Time</div>
            <div className="text-gray-600">{new Date(data.recommendedDepartureTime).toLocaleTimeString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Bus size={16} className="text-blue-600" />
          <div>
            <div className="font-medium">Buses Needed</div>
            <div className="text-gray-600">{data.busCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <DollarSign size={16} className="text-blue-600" />
          <div>
            <div className="font-medium">Estimated Cost</div>
            <div className="text-gray-600">${data.estimatedCost.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-blue-200">
        <p className="text-sm text-gray-700">{data.reasoning}</p>
      </div>
    </div>
  );
}
