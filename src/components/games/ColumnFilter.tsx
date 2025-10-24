"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Popover,
  Box,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  Divider,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Chip,
} from "@mui/material";
import { FilterList, Close, Search, Check } from "@mui/icons-material";
import type { ColumnFilterValue, FilterCondition } from "@/types/filters";

export type { ColumnFilterValue, FilterCondition } from "@/types/filters";

interface ColumnFilterProps {
  columnId: string;
  columnName: string;
  columnType?: "text" | "date" | "number" | "select";
  uniqueValues?: string[];
  currentFilter?: ColumnFilterValue;
  onFilterChange: (columnId: string, filter: ColumnFilterValue | null) => void;
}

const CONDITION_OPTIONS: Record<string, { label: string; requiresValue: boolean; requiresSecondValue?: boolean }> = {
  equals: { label: "Equals", requiresValue: true },
  not_equals: { label: "Does not equal", requiresValue: true },
  contains: { label: "Contains", requiresValue: true },
  not_contains: { label: "Does not contain", requiresValue: true },
  starts_with: { label: "Starts with", requiresValue: true },
  ends_with: { label: "Ends with", requiresValue: true },
  is_empty: { label: "Is empty", requiresValue: false },
  is_not_empty: { label: "Is not empty", requiresValue: false },
  greater_than: { label: "Greater than", requiresValue: true },
  less_than: { label: "Less than", requiresValue: true },
  between: { label: "Between", requiresValue: true, requiresSecondValue: true },
};

export function ColumnFilter({ columnId, columnName, columnType = "text", uniqueValues = [], currentFilter, onFilterChange }: ColumnFilterProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [filterTab, setFilterTab] = useState<"condition" | "values">("values");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<FilterCondition>("contains");
  const [conditionValue, setConditionValue] = useState("");
  const [conditionSecondValue, setConditionSecondValue] = useState("");
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());

  const isOpen = Boolean(anchorEl);

  // Initialize from currentFilter
  useEffect(() => {
    if (currentFilter) {
      if (currentFilter.type === "condition") {
        setFilterTab("condition");
        setSelectedCondition(currentFilter.condition || "contains");
        setConditionValue(currentFilter.value || "");
        setConditionSecondValue(currentFilter.secondValue || "");
      } else if (currentFilter.type === "values") {
        setFilterTab("values");
        setSelectedValues(new Set(currentFilter.values || []));
      }
    } else {
      // Reset
      setSelectedValues(new Set());
      setConditionValue("");
      setConditionSecondValue("");
    }
  }, [currentFilter]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm("");
  };

  const filteredValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    return uniqueValues.filter((value) => value.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [uniqueValues, searchTerm]);

  const handleValueToggle = (value: string) => {
    const newSelected = new Set(selectedValues);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setSelectedValues(newSelected);
  };

  const handleSelectAll = () => {
    setSelectedValues(new Set(filteredValues));
  };

  const handleClearAll = () => {
    setSelectedValues(new Set());
  };

  const handleApplyFilter = () => {
    if (filterTab === "values") {
      if (selectedValues.size === 0 || selectedValues.size === uniqueValues.length) {
        // No filter or all selected = clear filter
        onFilterChange(columnId, null);
      } else {
        onFilterChange(columnId, {
          type: "values",
          values: Array.from(selectedValues),
        });
      }
    } else {
      // condition filter
      const conditionConfig = CONDITION_OPTIONS[selectedCondition];
      if (!conditionConfig.requiresValue || conditionValue.trim()) {
        onFilterChange(columnId, {
          type: "condition",
          condition: selectedCondition,
          value: conditionValue,
          secondValue: conditionConfig.requiresSecondValue ? conditionSecondValue : undefined,
        });
      }
    }
    handleClose();
  };

  const handleClearFilter = () => {
    onFilterChange(columnId, null);
    setSelectedValues(new Set());
    setConditionValue("");
    setConditionSecondValue("");
    handleClose();
  };

  const hasActiveFilter = currentFilter !== null && currentFilter !== undefined;
  const conditionConfig = CONDITION_OPTIONS[selectedCondition];

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        sx={{
          ml: 0.5,
          color: hasActiveFilter ? "primary.main" : "action.active",
        }}
      >
        <FilterList fontSize="small" />
      </IconButton>

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        PaperProps={{
          sx: { width: 320, maxHeight: 500 },
        }}
      >
        <Box sx={{ p: 2 }}>
          {/* Header */}
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Filter: {columnName}
            </Typography>
            <IconButton size="small" onClick={handleClose}>
              <Close fontSize="small" />
            </IconButton>
          </Box>

          {/* Tab Switcher */}
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button size="small" variant={filterTab === "values" ? "contained" : "outlined"} onClick={() => setFilterTab("values")} fullWidth sx={{ textTransform: "none" }}>
              Filter by values
            </Button>
            <Button size="small" variant={filterTab === "condition" ? "contained" : "outlined"} onClick={() => setFilterTab("condition")} fullWidth sx={{ textTransform: "none" }}>
              Filter by condition
            </Button>
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {/* Values Tab */}
          {filterTab === "values" && (
            <Box>
              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder={`Search ${columnName.toLowerCase()}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "action.active" }} />,
                }}
                sx={{ mb: 2 }}
              />

              {/* Select/Clear All */}
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                <Button size="small" onClick={handleSelectAll} sx={{ textTransform: "none", fontSize: 12 }}>
                  Select all
                </Button>
                <Button size="small" onClick={handleClearAll} sx={{ textTransform: "none", fontSize: 12 }}>
                  Clear all
                </Button>
              </Stack>

              {/* Value List */}
              <Box
                sx={{
                  maxHeight: 250,
                  overflow: "auto",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                }}
              >
                <List dense sx={{ p: 0 }}>
                  {filteredValues.length === 0 ? (
                    <ListItem>
                      <ListItemText
                        primary="No values found"
                        primaryTypographyProps={{
                          variant: "body2",
                          color: "text.secondary",
                        }}
                      />
                    </ListItem>
                  ) : (
                    filteredValues.map((value) => (
                      <ListItemButton key={value} onClick={() => handleValueToggle(value)} dense sx={{ py: 0.5 }}>
                        <Checkbox edge="start" checked={selectedValues.has(value)} tabIndex={-1} disableRipple size="small" />
                        <ListItemText
                          primary={value || "(Empty)"}
                          primaryTypographyProps={{
                            variant: "body2",
                            sx: { fontSize: 13 },
                          }}
                        />
                      </ListItemButton>
                    ))
                  )}
                </List>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                {selectedValues.size} of {uniqueValues.length} selected
              </Typography>
            </Box>
          )}

          {/* Condition Tab */}
          {filterTab === "condition" && (
            <Box>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Condition</InputLabel>
                <Select value={selectedCondition} onChange={(e) => setSelectedCondition(e.target.value as FilterCondition)} label="Condition">
                  {Object.entries(CONDITION_OPTIONS).map(([key, { label }]) => (
                    <MenuItem key={key} value={key}>
                      {label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {conditionConfig.requiresValue && (
                <TextField
                  fullWidth
                  size="small"
                  label="Value"
                  value={conditionValue}
                  onChange={(e) => setConditionValue(e.target.value)}
                  sx={{ mb: 2 }}
                  type={columnType === "number" ? "number" : columnType === "date" ? "date" : "text"}
                  InputLabelProps={columnType === "date" ? { shrink: true } : undefined}
                />
              )}

              {conditionConfig.requiresSecondValue && (
                <TextField
                  fullWidth
                  size="small"
                  label="Second value"
                  value={conditionSecondValue}
                  onChange={(e) => setConditionSecondValue(e.target.value)}
                  sx={{ mb: 2 }}
                  type={columnType === "number" ? "number" : columnType === "date" ? "date" : "text"}
                  InputLabelProps={columnType === "date" ? { shrink: true } : undefined}
                />
              )}

              <Typography variant="caption" color="text.secondary">
                Apply a condition-based filter to this column
              </Typography>
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          {/* Action Buttons */}
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="outlined" onClick={handleClearFilter} disabled={!hasActiveFilter} sx={{ textTransform: "none" }}>
              Clear filter
            </Button>
            <Button fullWidth variant="contained" onClick={handleApplyFilter} sx={{ textTransform: "none" }}>
              Apply filter
            </Button>
          </Stack>
        </Box>
      </Popover>
    </>
  );
}
