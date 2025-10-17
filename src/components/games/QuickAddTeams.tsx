"use client";

import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, CircularProgress, Select, MenuItem, FormControl, InputLabel, TextField, Divider } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface QuickAddTeamProps {
  open: boolean;
  onClose: () => void;
  onCreated: (sport: string, level: string) => void;
}

const PRESET_SPORTS = ["Boys Basketball", "Girls Basketball", "Boys Flag Football", "Girls Flag Football", "Girls Tennis", "Boys Tennis", "Boys Soccer", "Girls Soccer", "Boys Cross Country"];

const PRESET_LEVELS = [
  { label: "Varsity", value: "VARSITY" },
  { label: "Junior Varsity", value: "JV" },
  { label: "Freshman", value: "FRESHMAN" },
];

export function QuickAddTeam({ open, onClose, onCreated }: QuickAddTeamProps) {
  const queryClient = useQueryClient();
  const [sport, setSport] = useState("");
  const [customSport, setCustomSport] = useState("");
  const [level, setLevel] = useState("");
  const [customLevel, setCustomLevel] = useState("");

  const isCustomSport = sport === "__custom__";
  const isCustomLevel = level === "__custom__";

  const createMutation = useMutation({
    mutationFn: async (data: { sportName: string; levelValue: string }) => {
      // First, find or create the sport
      const sportRes = await fetch("/api/sports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.sportName,
          season: "FALL", // Default season
        }),
      });

      let sportData;
      if (sportRes.ok) {
        sportData = await sportRes.json();
      } else {
        // Sport might already exist, try to fetch it
        const existingSportRes = await fetch(`/api/sports?name=${encodeURIComponent(data.sportName)}`);
        if (existingSportRes.ok) {
          sportData = await existingSportRes.json();
        } else {
          throw new Error("Failed to create or find sport");
        }
      }

      const sportId = sportData.data?.id || sportData.id;

      // Now create the team
      const teamRes = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${data.sportName} ${data.levelValue}`,
          sportId,
          level: data.levelValue,
        }),
      });

      if (!teamRes.ok) {
        const error = await teamRes.json();
        throw new Error(error.error || "Failed to create team");
      }

      return teamRes.json();
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["teams"] });
      onCreated(variables.sportName, variables.levelValue);
      setSport("");
      setCustomSport("");
      setLevel("");
      setCustomLevel("");
      onClose();
    },
  });

  const handleSubmit = () => {
    const finalSport = isCustomSport ? customSport.trim() : sport;
    const finalLevel = isCustomLevel ? customLevel.trim().toUpperCase().replace(/\s+/g, "_") : level;

    if (!finalSport || !finalLevel) return;

    createMutation.mutate({ sportName: finalSport, levelValue: finalLevel });
  };

  const handleClose = () => {
    setSport("");
    setCustomSport("");
    setLevel("");
    setCustomLevel("");
    onClose();
  };

  const isValid = () => {
    const hasSport = isCustomSport ? customSport.trim() : sport;
    const hasLevel = isCustomLevel ? customLevel.trim() : level;
    return hasSport && hasLevel;
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add New Team</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <FormControl fullWidth>
            <InputLabel>Sport</InputLabel>
            <Select
              value={sport}
              label="Sport"
              onChange={(e) => {
                setSport(e.target.value);
                if (e.target.value !== "__custom__") {
                  setCustomSport("");
                }
              }}
            >
              {PRESET_SPORTS.map((sportName) => (
                <MenuItem key={sportName} value={sportName}>
                  {sportName}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value="__custom__" sx={{ color: "primary.main", fontWeight: 600 }}>
                + Custom Sport...
              </MenuItem>
            </Select>
          </FormControl>

          {isCustomSport && <TextField label="Custom Sport Name" value={customSport} onChange={(e) => setCustomSport(e.target.value)} placeholder="e.g., Boys Volleyball" fullWidth autoFocus />}

          <FormControl fullWidth>
            <InputLabel>Level</InputLabel>
            <Select
              value={level}
              label="Level"
              onChange={(e) => {
                setLevel(e.target.value);
                if (e.target.value !== "__custom__") {
                  setCustomLevel("");
                }
              }}
            >
              {PRESET_LEVELS.map((levelOption) => (
                <MenuItem key={levelOption.value} value={levelOption.value}>
                  {levelOption.label}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value="__custom__" sx={{ color: "primary.main", fontWeight: 600 }}>
                + Custom Level...
              </MenuItem>
            </Select>
          </FormControl>

          {isCustomLevel && <TextField label="Custom Level Name" value={customLevel} onChange={(e) => setCustomLevel(e.target.value)} placeholder="e.g., Middle School" fullWidth autoFocus />}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={createMutation.isPending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid() || createMutation.isPending}>
          {createMutation.isPending ? <CircularProgress size={20} /> : "Add Team"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
