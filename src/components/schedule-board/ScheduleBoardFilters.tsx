"use client";

import { Box, Chip, CircularProgress, Stack, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

interface FilterOption {
  sport:  string;
  level:  string;
  gender: string;
  label:  string;
  count:  number;
}

interface Props {
  selected: { sport?: string; level?: string; gender?: string } | null;
  onChange: (filter: { sport: string; level: string; gender: string } | null) => void;
}

export function ScheduleBoardFilters({ selected, onChange }: Props) {
  const { data, isLoading } = useQuery({
    queryKey:  ["schedule-board-filters"],
    queryFn:   () =>
      fetch("/api/schedule-board/filters").then((r) => r.json()) as Promise<{ options: FilterOption[] }>,
    staleTime: 60_000,
  });

  const options = data?.options ?? [];

  if (isLoading) return <CircularProgress size={20} />;
  if (!options.length) return null;

  const isSelected = (opt: FilterOption) =>
    selected?.sport === opt.sport && selected?.level === opt.level && selected?.gender === opt.gender;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
        Filter by sport
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {options.map((opt) => (
          <Chip
            key={`${opt.sport}-${opt.level}-${opt.gender}`}
            label={`${opt.label} (${opt.count})`}
            size="small"
            variant={isSelected(opt) ? "filled" : "outlined"}
            color={isSelected(opt) ? "primary" : "default"}
            onClick={() =>
              isSelected(opt)
                ? onChange(null)
                : onChange({ sport: opt.sport, level: opt.level, gender: opt.gender })
            }
            sx={{ cursor: "pointer", fontWeight: isSelected(opt) ? 700 : 400 }}
          />
        ))}
        {selected && (
          <Chip
            label="Clear filter ×"
            size="small"
            variant="outlined"
            color="error"
            onClick={() => onChange(null)}
            sx={{ cursor: "pointer" }}
          />
        )}
      </Stack>
    </Box>
  );
}
