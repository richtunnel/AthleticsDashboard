export type Game = {
  id: string;
  date: Date;
  time: string | null;
  status: string;
  isHome: boolean;
  homeTeam: {
    name: string;
    level: string;
    sport: { name: string };
  };
  awayTeam?: {
    name: string;
  };
  opponent?: {
    name: string;
  };
  venue?: {
    name: string;
    city: string;
  };
  travelRequired: boolean;
  estimatedTravelTime: number | null;
};

export type FilterState = {
  sport: string;
  level: string;
  status: string;
  dateRange: "all" | "upcoming" | "past";
  searchTerm: string;
};

export interface TravelStats {
  _sum: {
    travelCost: number | null;
    estimatedTravelTime: number | null;
  };
  _count: number;
}

export interface SportStat {
  _count: number;
}

export interface AnalyticsData {
  upcomingGamesCount: number;
  travelStats: TravelStats;
  gamesBySport: SportStat[];
  sportStats?: Record<string, number>;
}
