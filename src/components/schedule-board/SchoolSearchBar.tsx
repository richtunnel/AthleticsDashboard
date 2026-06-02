"use client";

import { useState, useCallback } from "react";
import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

interface SchoolResult {
  id:         string;
  schoolName: string | null;
  city:       string | null;
}

interface Props {
  onSelect: (schoolId: string | null) => void;
}

export function SchoolSearchBar({ onSelect }: Props) {
  const [inputValue, setInputValue]   = useState("");
  const [options,    setOptions]      = useState<SchoolResult[]>([]);
  const [loading,    setLoading]      = useState(false);

  const fetchOptions = useCallback(
    async (q: string) => {
      if (q.length < 2) { setOptions([]); return; }
      setLoading(true);
      try {
        const res  = await fetch(`/api/schedule-board/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setOptions(data.results ?? []);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Debounce 250ms
  const debounced = useCallback(
    (() => {
      let timer: ReturnType<typeof setTimeout>;
      return (q: string) => {
        clearTimeout(timer);
        timer = setTimeout(() => fetchOptions(q), 250);
      };
    })(),
    [fetchOptions]
  );

  return (
    <Autocomplete
      freeSolo
      options={options}
      getOptionLabel={(opt) =>
        typeof opt === "string"
          ? opt
          : `${opt.schoolName ?? "Unknown School"}${opt.city ? ` — ${opt.city}` : ""}`
      }
      filterOptions={(x) => x} // server-side filtering
      loading={loading}
      inputValue={inputValue}
      onInputChange={(_, val) => {
        setInputValue(val);
        debounced(val);
        if (!val) onSelect(null);
      }}
      onChange={(_, val) => {
        if (val && typeof val !== "string") {
          onSelect(val.id);
        } else {
          onSelect(null);
        }
      }}
      sx={{ minWidth: 260, flex: 1 }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          placeholder="Search by school name…"
          InputProps={{
            ...params.InputProps,
            startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, color: "text.disabled" }} />,
            endAdornment: (
              <>
                {loading && <CircularProgress size={16} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
