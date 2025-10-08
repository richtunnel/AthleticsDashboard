"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Filter, Plus, Mail, Calendar, MapPin, Trash2, Edit } from "lucide-react";
import { ImportButton, ExportButton } from "../import-export/ImportExportButton";
import type { GameQuery } from "@/lib/validations/game";

export function GamesTable() {
  const [filters, setFilters] = useState<Partial<GameQuery>>({
    sport: undefined,
    level: undefined,
    status: undefined,
    dateRange: "upcoming",
    search: "",
    page: 1,
    limit: 50,
  });
  const [showFilters, setShowFilters] = useState(false);

  // Fetch games
  const { data, isLoading, error } = useQuery({
    queryKey: ["games", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") {
          params.append(key, String(value));
        }
      });
      const res = await fetch(`/api/games?${params}`);
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  const games = data?.data?.games || [];
  const pagination = data?.data?.pagination;

  // Get unique sports and levels for filters
  const sports = [...new Set(games.map((g: any) => g.homeTeam?.sport?.name))].filter(Boolean);
  const levels = [...new Set(games.map((g: any) => g.homeTeam?.level))].filter(Boolean);

  const [showGameForm, setShowGameForm] = useState(false);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev: any) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleEditGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setShowGameForm(true);
  };

  const handleEmailGame = (gameId: string) => {
    setSelectedGameId(gameId);
    setShowEmailComposer(true);
  };

  if (error) {
    return <div className="p-8 text-center text-red-600">Error loading games. Please try again.</div>;
  }

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Game Schedule</h1>
          <div className="flex gap-2">
            <ImportButton />
            <ExportButton />
            <button onClick={() => setShowFilters(!showFilters)} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50 transition">
              <Filter size={16} />
              Filters
            </button>
            <button
              onClick={() => {
                setSelectedGameId(null);
                setShowGameForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus size={16} />
              Add Game
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 border rounded-lg bg-gray-50 grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Sport</label>
              <select
                value={filters.sport || ""}
                onChange={(e) => handleFilterChange("sport", e.target.value || undefined)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Sports</option>
                {sports.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Level</label>
              <select
                value={filters.level || ""}
                onChange={(e) => handleFilterChange("level", e.target.value || undefined)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Levels</option>
                {levels.map((level: any) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                value={filters.status || ""}
                onChange={(e) => handleFilterChange("status", e.target.value || undefined)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">All Status</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="POSTPONED">Postponed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Date Range</label>
              <select
                value={filters.dateRange || "all"}
                onChange={(e) => handleFilterChange("dateRange", e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="all">All Dates</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Search</label>
              <input
                type="text"
                placeholder="Team, opponent, venue..."
                value={filters.search || ""}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Games" value={pagination?.total || 0} isLoading={isLoading} />
          <StatCard label="Home Games" value={games.filter((g: any) => g.isHome).length} isLoading={isLoading} />
          <StatCard label="Away Games" value={games.filter((g: any) => !g.isHome).length} isLoading={isLoading} />
          <StatCard label="Requires Travel" value={games.filter((g: any) => g.travelRequired).length} isLoading={isLoading} />
        </div>

        {/* Games Table */}
        <div className="border rounded-lg overflow-hidden bg-white">
          {isLoading ? (
            <div className="p-12 text-center text-gray-500">Loading games...</div>
          ) : games.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No games found matching your filters</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Time</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Sport</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Level</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Opponent</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Travel</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {games.map((game: any) => (
                  <tr key={game.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-sm">{format(new Date(game.date), "MMM dd, yyyy")}</td>
                    <td className="px-4 py-3 text-sm">{game.time || "-"}</td>
                    <td className="px-4 py-3 text-sm">{game.homeTeam?.sport?.name}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">{game.homeTeam?.level}</span>
                    </td>
                    <td className="px-4 py-3 text-sm">{game.opponent?.name || game.awayTeam?.name || "-"}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-1">
                        <MapPin size={14} className="text-gray-400" />
                        {game.isHome ? "Home" : game.venue?.name || "-"}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={game.status} />
                    </td>
                    <td className="px-4 py-3 text-sm">{game.travelRequired ? `${game.estimatedTravelTime || "?"} min` : "-"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => handleEditGame(game.id)} className="p-1.5 hover:bg-gray-200 rounded transition" title="Edit">
                          <Edit size={16} className="text-gray-600" />
                        </button>
                        <button onClick={() => handleEmailGame(game.id)} className="p-1.5 hover:bg-gray-200 rounded transition" title="Send Email">
                          <Mail size={16} className="text-gray-600" />
                        </button>
                        <CalendarSyncButton gameId={game.id} isSynced={game.calendarSynced} />
                        <button className="p-1.5 hover:bg-red-100 rounded transition" title="Delete">
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {(pagination.page - 1) * pagination.limit + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} games
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleFilterChange("page", pagination.page - 1)}
                disabled={!pagination.hasPrev}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                onClick={() => handleFilterChange("page", pagination.page + 1)}
                disabled={!pagination.hasNext}
                className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showGameForm && (
        <GameForm
          gameId={selectedGameId || undefined}
          onClose={() => {
            setShowGameForm(false);
            setSelectedGameId(null);
          }}
          onSuccess={() => {
            setShowGameForm(false);
            setSelectedGameId(null);
          }}
        />
      )}

      {showEmailComposer && (
        <EmailComposer
          gameId={selectedGameId || undefined}
          onClose={() => {
            setShowEmailComposer(false);
            setSelectedGameId(null);
          }}
        />
      )}
    </>
  );
}

function StatCard({ label, value, isLoading }: { label: string; value: number; isLoading: boolean }) {
  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="text-2xl font-bold">{isLoading ? "..." : value.toLocaleString()}</div>
      <div className="text-sm text-gray-600">{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    SCHEDULED: "bg-gray-100 text-gray-800",
    CONFIRMED: "bg-green-100 text-green-800",
    POSTPONED: "bg-yellow-100 text-yellow-800",
    CANCELLED: "bg-red-100 text-red-800",
    COMPLETED: "bg-blue-100 text-blue-800",
  };

  return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status as keyof typeof styles] || styles.SCHEDULED}`}>{status}</span>;
}
