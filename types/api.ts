// API Response Types
export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Pagination
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Games API
export interface GamesListResponse {
  games: any[];
  pagination: PaginationMeta;
}

// Analytics API
export interface TravelStats {
  _sum: {
    travelCost: number | null;
    estimatedTravelTime: number | null;
  };
  _count: number;
}

export interface AnalyticsResponse {
  upcomingGamesCount: number;
  travelStats: TravelStats;
  gamesBySport: Array<{ _count: number }>;
  sportStats?: Record<string, number>;
}

// Email API
export interface EmailResult {
  success: boolean;
  emailId?: string;
}

// Calendar API
export interface CalendarSyncResult {
  success: boolean;
}

// Import/Export API
export interface ImportResult {
  success: number;
  errors: string[];
}
