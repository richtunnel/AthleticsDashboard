import { z } from "zod";

// Game Schemas
export const createGameSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
  homeTeamId: z.string(),
  awayTeamId: z.string().optional(),
  isHome: z.boolean().default(true),
  opponentId: z.string().optional(),
  venueId: z.string().optional(),
  status: z.enum(["SCHEDULED", "CONFIRMED", "POSTPONED", "CANCELLED", "COMPLETED"]).optional().default("SCHEDULED"),
  travelRequired: z.boolean().optional().default(false),
  estimatedTravelTime: z.number().optional(),
  departureTime: z.string().optional(),
  busCount: z.number().optional(),
  travelCost: z.number().optional(),
  notes: z.string().optional(),
});

export const updateGameSchema = createGameSchema.partial();

// Email Schemas
export const sendEmailSchema = z.object({
  to: z.array(z.string().email()),
  cc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  body: z.string().min(1),
  gameId: z.string().optional(),
});

// Team Schemas
export const createTeamSchema = z.object({
  name: z.string().min(1),
  sportId: z.string(),
  level: z.enum(["VARSITY", "JV", "FRESHMAN", "MIDDLE_SCHOOL", "YOUTH"]),
  gender: z.enum(["MALE", "FEMALE", "COED"]).optional(),
  organizationId: z.string(),
});

export const updateTeamSchema = createTeamSchema.partial();

// Venue Schemas
export const createVenueSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  notes: z.string().optional(),
  organizationId: z.string(),
});

export const updateVenueSchema = createVenueSchema.partial();

// Opponent Schemas
export const createOpponentSchema = z.object({
  name: z.string().min(1),
  mascot: z.string().optional(),
  colors: z.string().optional(),
  contact: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
  organizationId: z.string(),
});

export const updateOpponentSchema = createOpponentSchema.partial();

// Types
export type CreateGame = z.infer<typeof createGameSchema>;
export type UpdateGame = z.infer<typeof updateGameSchema>;
export type SendEmail = z.infer<typeof sendEmailSchema>;

export type CreateTeam = z.infer<typeof createTeamSchema>;
export type UpdateTeam = z.infer<typeof updateTeamSchema>;

export type CreateVenue = z.infer<typeof createVenueSchema>;
export type UpdateVenue = z.infer<typeof updateVenueSchema>;

export type CreateOpponent = z.infer<typeof createOpponentSchema>;
export type UpdateOpponent = z.infer<typeof updateOpponentSchema>;

// Query Types
export type GameQuery = {
  sport?: string;
  level?: string;
  status?: string;
  dateRange?: "all" | "upcoming" | "past";
  search?: string;
  page?: number;
  limit?: number;
};

// Entity Types (matching Prisma schema)
export type Team = {
  id: string;
  name: string;
  level: string;
  gender?: string;
  sportId: string;
  organizationId: string;
  sport: {
    id: string;
    name: string;
    season: string;
  };
  createdAt: Date;
  updatedAt: Date;
};

export type Venue = {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type Opponent = {
  id: string;
  name: string;
  mascot?: string;
  colors?: string;
  contact?: string;
  phone?: string;
  email?: string;
  notes?: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
};
