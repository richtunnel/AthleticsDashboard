export type Game = {
  id: string;
  date: string;
  time: string | null;
  status: string;
  isHome: boolean;
  travelRequired: boolean;
  estimatedTravelTime: number | null;
  calendarSynced?: boolean;
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
  awayTeam?: {
    name: string;
  };
  venue?: {
    name: string;
    city: string;
  };
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

export interface RouteParams {
  params: { id: string };
}
