"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { fetchEmailGroups } from "@/lib/api/emailGroups";
import type { EmailGroup } from "./types";

interface BulkEmailDropdownProps {
  value: string;
  onChange: (groupId: string) => void;
  label?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  allowEmpty?: boolean;
  error?: boolean;
}

export function BulkEmailDropdown({
  value,
  onChange,
  label = "Email Group",
  helperText,
  disabled,
  required,
  allowEmpty = true,
  error,
}: BulkEmailDropdownProps) {
  const {
    data: groups = [],
    isLoading,
    isError,
  } = useQuery<EmailGroup[], Error>({ queryKey: ["email-groups"], queryFn: fetchEmailGroups });

  const handleChange = (event: SelectChangeEvent<string>) => {
    onChange(event.target.value);
  };

  const placeholder = useMemo(() => {
    if (isLoading) {
      return "Loading groups...";
    }
    if (groups.length === 0) {
      return "No groups available";
    }
    return "Select email group";
  }, [groups.length, isLoading]);

  return (
    <FormControl fullWidth disabled={disabled} required={required} error={error}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={value ?? ""}
        onChange={handleChange}
        displayEmpty
        renderValue={(selected) => {
          if (!selected) {
            return <Typography color="text.secondary">{placeholder}</Typography>;
          }

          const selectedGroup = groups.find((group) => group.id === selected);

          if (!selectedGroup) {
            return <Typography color="text.secondary">{placeholder}</Typography>;
          }

          return `${selectedGroup.name} (${selectedGroup._count.emails} emails)`;
        }}
      >
        {allowEmpty && (
          <MenuItem value="">
            <em>{placeholder}</em>
          </MenuItem>
        )}

        {isLoading && (
          <MenuItem value="loading" disabled>
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography>Loading groups...</Typography>
            </Stack>
          </MenuItem>
        )}

        {!isLoading && groups.length === 0 && (
          <MenuItem value="no-groups" disabled>
            No groups yet
          </MenuItem>
        )}

        {groups.map((group) => (
          <MenuItem key={group.id} value={group.id}>
            <Stack direction="row" justifyContent="space-between" width="100%">
              <Typography>{group.name}</Typography>
              <Typography color="text.secondary">{group._count.emails} emails</Typography>
            </Stack>
          </MenuItem>
        ))}
      </Select>

      {helperText && <FormHelperText>{helperText}</FormHelperText>}

      {isError && (
        <FormHelperText error>{"Unable to load email groups."}</FormHelperText>
      )}

      {!isLoading && groups.length === 0 && !isError && (
        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            No groups yet.
          </Typography>
          <Link href="/dashboard/email-groups">
            <Typography variant="body2" color="primary.main" sx={{ fontWeight: 600 }}>
              Create one now.
            </Typography>
          </Link>
        </Box>
      )}
    </FormControl>
  );
}
