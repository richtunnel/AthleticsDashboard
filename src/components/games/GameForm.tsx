"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createGameSchema } from "@/lib/validations/games";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import type { z } from "zod";

type GameFormData = z.infer<typeof createGameSchema>;

interface GameFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  gameId?: string;
}

export function GameForm({ onClose, onSuccess, gameId }: GameFormProps) {
  const isEditing = !!gameId;
  const queryClient = useQueryClient();

  // Fetch teams, venues, opponents
  const { data: teamsResponse } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const res = await fetch("/api/teams");
      if (!res.ok) throw new Error("Failed to fetch teams");
      return res.json();
    },
  });

  const { data: venuesResponse } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const res = await fetch("/api/venues");
      if (!res.ok) throw new Error("Failed to fetch venues");
      return res.json();
    },
  });

  const { data: opponentsResponse } = useQuery({
    queryKey: ["opponents"],
    queryFn: async () => {
      const res = await fetch("/api/opponents");
      if (!res.ok) throw new Error("Failed to fetch opponents");
      return res.json();
    },
  });

  const teams = teamsResponse?.data || [];
  const venues = venuesResponse?.data || [];
  const opponents = opponentsResponse?.data || [];

  // Fetch existing game if editing
  const { data: existingGameResponse } = useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const res = await fetch(`/api/games/${gameId}`);
      if (!res.ok) throw new Error("Failed to fetch game");
      return res.json();
    },
    enabled: isEditing,
  });

  const existingGame = existingGameResponse?.data;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<GameFormData>({
    resolver: zodResolver(createGameSchema),
    defaultValues: {
      isHome: true,
      travelRequired: false,
      status: "SCHEDULED",
    },
  });

  // Update form when existing game loads
  useEffect(() => {
    if (existingGame) {
      reset({
        date: existingGame.date?.split("T")[0],
        time: existingGame.time || undefined,
        homeTeamId: existingGame.homeTeamId,
        awayTeamId: existingGame.awayTeamId || undefined,
        isHome: existingGame.isHome,
        opponentId: existingGame.opponentId || undefined,
        venueId: existingGame.venueId || undefined,
        status: existingGame.status,
        travelRequired: existingGame.travelRequired,
        estimatedTravelTime: existingGame.estimatedTravelTime || undefined,
        departureTime: existingGame.departureTime || undefined,
        busCount: existingGame.busCount || undefined,
        travelCost: existingGame.travelCost || undefined,
        notes: existingGame.notes || undefined,
      });
    }
  }, [existingGame, reset]);

  const isHome = watch("isHome");
  const travelRequired = watch("travelRequired");

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: GameFormData) => {
      const url = isEditing ? `/api/games/${gameId}` : "/api/games";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save game");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      onSuccess?.();
      onClose();
    },
  });

  const onSubmit = (data: GameFormData) => {
    mutation.mutate(data);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose} />

        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-2xl font-bold">{isEditing ? "Edit Game" : "Create New Game"}</h2>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition">
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Date <span className="text-red-500">*</span>
                </label>
                <input type="date" {...register("date")} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                {errors.date && <p className="text-red-500 text-sm mt-1">{errors.date.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <input type="time" {...register("time")} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                {errors.time && <p className="text-red-500 text-sm mt-1">{errors.time.message}</p>}
              </div>
            </div>

            {/* Home Team */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Team <span className="text-red-500">*</span>
              </label>
              <select {...register("homeTeamId")} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Select team</option>
                {teams.map((team: any) => (
                  <option key={team.id} value={team.id}>
                    {team.sport?.name} - {team.level} ({team.name})
                  </option>
                ))}
              </select>
              {errors.homeTeamId && <p className="text-red-500 text-sm mt-1">{errors.homeTeamId.message}</p>}
            </div>

            {/* Home/Away */}
            <div>
              <label className="block text-sm font-medium mb-2">Location Type</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input type="radio" value="true" checked={isHome === true} onChange={() => setValue("isHome", true)} className="mr-2" />
                  Home Game
                </label>
                <label className="flex items-center">
                  <input type="radio" value="false" checked={isHome === false} onChange={() => setValue("isHome", false)} className="mr-2" />
                  Away Game
                </label>
              </div>
            </div>

            {/* Opponent */}
            <div>
              <label className="block text-sm font-medium mb-2">Opponent</label>
              <select {...register("opponentId")} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">Select opponent</option>
                {opponents.map((opponent: any) => (
                  <option key={opponent.id} value={opponent.id}>
                    {opponent.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Venue (only for away games) */}
            {!isHome && (
              <div>
                <label className="block text-sm font-medium mb-2">Venue</label>
                <select {...register("venueId")} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="">Select venue</option>
                  {venues.map((venue: any) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name} - {venue.city}, {venue.state}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status */}
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select {...register("status")} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="SCHEDULED">Scheduled</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="POSTPONED">Postponed</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </div>

            {/* Travel Information */}
            <div className="border-t pt-6">
              <div className="flex items-center mb-4">
                <input type="checkbox" checked={travelRequired} onChange={(e) => setValue("travelRequired", e.target.checked)} className="mr-2" />
                <label className="text-sm font-medium">Travel Required</label>
              </div>

              {travelRequired && (
                <div className="grid grid-cols-3 gap-4 pl-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Travel Time (minutes)</label>
                    <input
                      type="number"
                      {...register("estimatedTravelTime", { valueAsNumber: true })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Number of Buses</label>
                    <input type="number" {...register("busCount", { valueAsNumber: true })} className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Travel Cost ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register("travelCost", { valueAsNumber: true })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                {...register("notes")}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Add any additional notes about this game..."
              />
            </div>

            {/* Error Display */}
            {mutation.isError && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{mutation.error?.message || "Failed to save game"}</div>}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t">
              <button type="button" onClick={onClose} className="px-6 py-2 border rounded-lg hover:bg-gray-50 transition">
                Cancel
              </button>
              <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                {mutation.isPending ? "Saving..." : isEditing ? "Update Game" : "Create Game"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
