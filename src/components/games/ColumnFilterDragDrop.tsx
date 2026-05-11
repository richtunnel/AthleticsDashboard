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
  Paper,
  Tabs,
  Tab,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { FilterList, Close, Search, Check, DragIndicator, Clear } from "@mui/icons-material";
import type { ColumnFilterValue, FilterCondition } from "@/types/filters";
import { ReactSortable } from "react-sortablejs";

export type { ColumnFilterValue, FilterCondition } from "@/types/filters";

interface ColumnFilterDragDropProps {
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

// Operators that make sense for date fields (human-friendly labels)
const DATE_CONDITION_OPTIONS: Record<string, { label: string; requiresValue: boolean; requiresSecondValue?: boolean; inputType?: "date" | "month" | "year" }> = {
  equals:      { label: "On date",        requiresValue: true,  inputType: "date" },
  not_equals:  { label: "Not on date",    requiresValue: true,  inputType: "date" },
  less_than:   { label: "Before",         requiresValue: true,  inputType: "date" },
  greater_than:{ label: "After",          requiresValue: true,  inputType: "date" },
  between:     { label: "Between",        requiresValue: true,  requiresSecondValue: true, inputType: "date" },
  in_month:    { label: "In month",       requiresValue: true,  inputType: "month" },
  in_year:     { label: "In year",        requiresValue: true,  inputType: "year" },
  is_empty:    { label: "Is empty",       requiresValue: false },
  is_not_empty:{ label: "Is not empty",   requiresValue: false },
};

// ── Date formatting helpers ──────────────────────────────────────────────────

/** Formats a raw filter value for human display in the filter panel. */
function formatFilterValue(raw: string, columnType: string): string {
  if (columnType !== "date") return raw;

  // Month token: "month:YYYY-MM" → "January 2026"
  if (raw.startsWith("month:")) {
    const [yyyy, mm] = raw.slice(6).split("-").map(Number);
    if (!yyyy || !mm) return raw;
    const d = new Date(Date.UTC(yyyy, mm - 1, 1));
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  // Year token: "year:YYYY" → "2026"
  if (raw.startsWith("year:")) return raw.slice(5);
  // Exact date: "YYYY-MM-DD" → "Jan 29, 2026"
  const d = new Date(raw + "T00:00:00Z");
  if (isNaN(d.getTime())) return raw;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/** Returns the section a raw date filter value belongs to. */
function dateValueSection(raw: string): "year" | "month" | "date" {
  if (raw.startsWith("year:")) return "year";
  if (raw.startsWith("month:")) return "month";
  return "date";
}

interface DragItem {
  id: string;
  name: string;
  chosen?: boolean;
}

export function ColumnFilterDragDrop({
  columnId,
  columnName,
  columnType = "text",
  uniqueValues = [],
  currentFilter,
  onFilterChange,
}: ColumnFilterDragDropProps) {
  const theme = useTheme();
  const [mounted, setMounted] = useState(false);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [filterMode, setFilterMode] = useState<"drag" | "values" | "condition">("values");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCondition, setSelectedCondition] = useState<FilterCondition>("contains");
  const [conditionValue, setConditionValue] = useState("");
  const [conditionSecondValue, setConditionSecondValue] = useState("");
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());

  // Drag & Drop state
  const [includedItems, setIncludedItems] = useState<DragItem[]>([]);
  const [excludedItems, setExcludedItems] = useState<DragItem[]>([]);
  const [availableItems, setAvailableItems] = useState<DragItem[]>([]);

  const isOpen = Boolean(anchorEl);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize drag items from uniqueValues
  // Only run when modal opens (anchorEl changes) to avoid infinite loops
  useEffect(() => {
    if (!isOpen) return;
    
    if (currentFilter && currentFilter.type === "values") {
      const included = currentFilter.values || [];
      const includedSet = new Set(included);
      
      const incItems: DragItem[] = included.map((val, idx) => ({
        id: `inc-${idx}-${val}`,
        name: val,
      }));

      const availItems: DragItem[] = uniqueValues
        .filter((val) => !includedSet.has(val))
        .map((val, idx) => ({
          id: `avail-${idx}-${val}`,
          name: val,
        }));

      setIncludedItems(incItems);
      setExcludedItems([]);
      setAvailableItems(availItems);
    } else {
      // No filter active, all items are available
      const availItems: DragItem[] = uniqueValues.map((val, idx) => ({
        id: `avail-${idx}-${val}`,
        name: val,
      }));
      setIncludedItems([]);
      setExcludedItems([]);
      setAvailableItems(availItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Initialize checkbox mode from currentFilter
  // Only run when modal opens to avoid infinite loops
  useEffect(() => {
    if (!isOpen) return;
    
    if (currentFilter) {
      if (currentFilter.type === "condition") {
        setFilterMode("condition");
        // If restoring a saved condition, fall back to a valid operator for the column type
        const savedCondition = currentFilter.condition || "contains";
        const validCondition =
          columnType === "date" && !(savedCondition in DATE_CONDITION_OPTIONS)
            ? "equals"
            : savedCondition;
        setSelectedCondition(validCondition);
        setConditionValue(currentFilter.value || "");
        setConditionSecondValue(currentFilter.secondValue || "");
      } else if (currentFilter.type === "values") {
        setSelectedValues(new Set(currentFilter.values || []));
      }
    } else {
      setSelectedValues(new Set());
      setConditionValue("");
      setConditionSecondValue("");
      // Reset to a valid operator when opening a date column with no existing filter
      if (columnType === "date") {
        setSelectedCondition("equals");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
    setSearchTerm("");
  };

  const filteredCheckboxValues = useMemo(() => {
    if (!searchTerm) return uniqueValues;
    // For date columns match against the human-readable label, not the raw token
    return uniqueValues.filter((value) =>
      formatFilterValue(value, columnType).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [uniqueValues, searchTerm, columnType]);

  const filteredAvailableItems = useMemo(() => {
    if (!searchTerm) return availableItems;
    return availableItems.filter((item) => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [availableItems, searchTerm]);

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
    setSelectedValues(new Set(filteredCheckboxValues));
  };

  const handleClearAll = () => {
    setSelectedValues(new Set());
  };

  const handleApplyDragFilter = () => {
    if (includedItems.length === 0) {
      onFilterChange(columnId, null);
    } else {
      onFilterChange(columnId, {
        type: "values",
        values: includedItems.map((item) => item.name),
      });
    }
    handleClose();
  };

  const handleApplyCheckboxFilter = () => {
    if (selectedValues.size === 0) {
      onFilterChange(columnId, null);
    } else {
      onFilterChange(columnId, {
        type: "values",
        values: Array.from(selectedValues),
      });
    }
    handleClose();
  };

  const handleApplyConditionFilter = () => {
    // Use the appropriate option set for this column type
    const opts = columnType === "date" ? DATE_CONDITION_OPTIONS : CONDITION_OPTIONS;
    const conditionConfig = opts[selectedCondition] ?? CONDITION_OPTIONS[selectedCondition];
    if (!conditionConfig) return;
    if (!conditionConfig.requiresValue || conditionValue.trim()) {
      onFilterChange(columnId, {
        type: "condition",
        condition: selectedCondition,
        value: conditionValue,
        secondValue: conditionConfig.requiresSecondValue ? conditionSecondValue : undefined,
      });
    }
    handleClose();
  };

  const handleClearFilter = () => {
    onFilterChange(columnId, null);
    setSelectedValues(new Set());
    setConditionValue("");
    setConditionSecondValue("");
    setIncludedItems([]);
    setExcludedItems([]);
    setAvailableItems(
      uniqueValues.map((val, idx) => ({
        id: `avail-${idx}-${val}`,
        name: val,
      }))
    );
    handleClose();
  };

  const handleMoveToIncluded = (item: DragItem) => {
    setAvailableItems((prev) => prev.filter((i) => i.id !== item.id));
    setIncludedItems((prev) => [...prev, { ...item, id: `inc-${Date.now()}-${item.name}` }]);
  };

  const handleMoveToAvailable = (item: DragItem) => {
    setIncludedItems((prev) => prev.filter((i) => i.id !== item.id));
    setAvailableItems((prev) => [...prev, { ...item, id: `avail-${Date.now()}-${item.name}` }]);
  };

  const handleMoveAllToIncluded = () => {
    const filtered = searchTerm ? filteredAvailableItems : availableItems;
    const toMove = filtered.map((item) => ({ ...item, id: `inc-${Date.now()}-${item.name}` }));
    setIncludedItems((prev) => [...prev, ...toMove]);
    setAvailableItems((prev) => prev.filter((item) => !filtered.find((f) => f.id === item.id)));
  };

  const handleMoveAllToAvailable = () => {
    const toMove = includedItems.map((item) => ({ ...item, id: `avail-${Date.now()}-${item.name}` }));
    setAvailableItems((prev) => [...prev, ...toMove]);
    setIncludedItems([]);
  };

  const hasActiveFilter = mounted && currentFilter !== null && currentFilter !== undefined;
  // conditionConfig is kept for backward-compat use in the JSX below (the
  // date-specific sections rebuild their own config inline via activeOpts)
  const conditionConfig = (columnType === "date" ? DATE_CONDITION_OPTIONS : CONDITION_OPTIONS)[selectedCondition]
    ?? CONDITION_OPTIONS[selectedCondition]
    ?? CONDITION_OPTIONS.contains;

  return (
    <>
      <IconButton
        size="small"
        onClick={handleOpen}
        sx={{
          ml: 0.5,
          color: hasActiveFilter ? "#6051f2" : "action.active",
          bgcolor: hasActiveFilter ? alpha("#6051f2", 0.08) : "transparent",
          "&:hover": {
            bgcolor: hasActiveFilter ? alpha("#6051f2", 0.15) : alpha(theme.palette.action.active, 0.04),
          },
        }}
      >
        <FilterList fontSize="small" sx={{ color: hasActiveFilter ? "#6051f2" : undefined }} />
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
        slotProps={{
          paper: {
            sx: {
              width: 320,
              maxHeight: 600,
              transition: "width 0.3s ease",
            },
          },
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
          <Tabs
            value={filterMode}
            onChange={(_, newValue) => setFilterMode(newValue)}
            variant="fullWidth"
            sx={{ mb: 2, minHeight: 36 }}
          >
            {/* <Tab label="Drag & Drop" value="drag" sx={{ textTransform: "none", minHeight: 36, py: 0.5 }} /> */}
            <Tab label="Select Values" value="values" sx={{ textTransform: "none", minHeight: 36, py: 0.5 }} />
            <Tab label="Condition" value="condition" sx={{ textTransform: "none", minHeight: 36, py: 0.5 }} />
          </Tabs>

          <Divider sx={{ mb: 2 }} />

          {/* Drag & Drop Mode - DISABLED */}
          {/* {filterMode === "drag" && (
            <Box>
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

              <Stack direction="row" spacing={2}>
                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      Available ({filteredAvailableItems.length})
                    </Typography>
                    <Button size="small" onClick={handleMoveAllToIncluded} sx={{ textTransform: "none", fontSize: 11, minWidth: 0, p: 0.5 }}>
                      Include All →
                    </Button>
                  </Box>
                  <Paper
                    variant="outlined"
                    sx={{
                      height: 300,
                      overflowY: "auto",
                      bgcolor: "#fafafa",
                      p: 1,
                      "&::-webkit-scrollbar": { width: "6px" },
                      "&::-webkit-scrollbar-track": { background: "#f1f1f1" },
                      "&::-webkit-scrollbar-thumb": { background: "#888", borderRadius: "3px" },
                    }}
                  >
                    <ReactSortable
                      list={filteredAvailableItems}
                      setList={(newState) => {
                        if (!searchTerm) {
                          setAvailableItems(newState);
                        }
                      }}
                      group="filterItems"
                      animation={200}
                      ghostClass="sortable-ghost"
                      chosenClass="sortable-chosen"
                      dragClass="sortable-drag"
                      handle=".drag-handle"
                      forceFallback={true}
                      fallbackClass="sortable-fallback"
                      fallbackOnBody={true}
                      swapThreshold={0.65}
                      style={{ minHeight: "100%" }}
                    >
                      {filteredAvailableItems.length === 0 ? (
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 280, color: "text.secondary" }}>
                          <Typography variant="caption">No items</Typography>
                        </Box>
                      ) : (
                        filteredAvailableItems.map((item) => (
                          <Paper
                            key={item.id}
                            elevation={1}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              p: 1,
                              mb: 0.5,
                              cursor: "move",
                              bgcolor: "white",
                              transition: "all 0.2s ease",
                              "&:hover": {
                                bgcolor: "#e3f2fd",
                                transform: "translateX(2px)",
                                boxShadow: 2,
                              },
                            }}
                            onClick={() => handleMoveToIncluded(item)}
                          >
                            <DragIndicator className="drag-handle" sx={{ fontSize: 16, mr: 1, color: "action.active", cursor: "grab" }} />
                            <Typography variant="body2" sx={{ fontSize: 13, flex: 1 }}>
                              {item.name || "(Empty)"}
                            </Typography>
                          </Paper>
                        ))
                      )}
                    </ReactSortable>
                  </Paper>
                </Box>

                <Box sx={{ flex: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="caption" fontWeight={600} color="primary.main">
                      ✓ Included ({includedItems.length})
                    </Typography>
                    <Button size="small" onClick={handleMoveAllToAvailable} sx={{ textTransform: "none", fontSize: 11, minWidth: 0, p: 0.5 }}>
                      ← Clear All
                    </Button>
                  </Box>
                  <Paper
                    variant="outlined"
                    sx={{
                      height: 300,
                      overflowY: "auto",
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                      p: 1,
                      borderColor: "primary.main",
                      borderWidth: 2,
                      "&::-webkit-scrollbar": { width: "6px" },
                      "&::-webkit-scrollbar-track": { background: "#f1f1f1" },
                      "&::-webkit-scrollbar-thumb": { background: "#888", borderRadius: "3px" },
                    }}
                  >
                    <ReactSortable
                      list={includedItems}
                      setList={setIncludedItems}
                      group="filterItems"
                      animation={200}
                      ghostClass="sortable-ghost"
                      chosenClass="sortable-chosen"
                      dragClass="sortable-drag"
                      handle=".drag-handle"
                      forceFallback={true}
                      fallbackClass="sortable-fallback"
                      fallbackOnBody={true}
                      swapThreshold={0.65}
                      style={{ minHeight: "100%" }}
                    >
                      {includedItems.length === 0 ? (
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: 280, color: "text.secondary" }}>
                          <Typography variant="caption" align="center">
                            Drag items here
                            <br />
                            or click to include
                          </Typography>
                        </Box>
                      ) : (
                        includedItems.map((item) => (
                          <Paper
                            key={item.id}
                            elevation={2}
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              p: 1,
                              mb: 0.5,
                              cursor: "move",
                              bgcolor: "white",
                              borderLeft: "3px solid",
                              borderLeftColor: "primary.main",
                              transition: "all 0.2s ease",
                              "&:hover": {
                                bgcolor: "#fff9e6",
                                transform: "translateX(-2px)",
                                boxShadow: 3,
                              },
                            }}
                            onClick={() => handleMoveToAvailable(item)}
                          >
                            <DragIndicator className="drag-handle" sx={{ fontSize: 16, mr: 1, color: "primary.main", cursor: "grab" }} />
                            <Typography variant="body2" sx={{ fontSize: 13, flex: 1, fontWeight: 500 }}>
                              {item.name || "(Empty)"}
                            </Typography>
                            <Check sx={{ fontSize: 14, color: "success.main" }} />
                          </Paper>
                        ))
                      )}
                    </ReactSortable>
                  </Paper>
                </Box>
              </Stack>

              <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1, p: 1, bgcolor: "#f5f5f5", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  💡 Drag items or click to move between columns. Only included items will be shown in the table.
                </Typography>
              </Box>
            </Box>
          )} */}

          {/* Select Values Mode */}
          {filterMode === "values" && (() => {
            // For date columns: split uniqueValues into year / month / exact-date groups
            // and render each as its own collapsible section.
            if (columnType === "date") {
              const years  = uniqueValues.filter((v) => v.startsWith("year:"));
              const months = uniqueValues.filter((v) => v.startsWith("month:"));
              const dates  = uniqueValues.filter((v) => !v.startsWith("year:") && !v.startsWith("month:"));

              const renderSection = (label: string, items: string[]) => {
                if (items.length === 0) return null;
                const filtered = searchTerm
                  ? items.filter((v) => formatFilterValue(v, "date").toLowerCase().includes(searchTerm.toLowerCase()))
                  : items;
                return (
                  <Box key={label} sx={{ mb: 1.5 }}>
                    <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ px: 0.5, display: "block", mb: 0.25 }}>
                      {label}
                    </Typography>
                    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                      <List dense sx={{ p: 0 }}>
                        {filtered.length === 0 ? (
                          <ListItem dense>
                            <ListItemText primary="No matches" primaryTypographyProps={{ variant: "body2", color: "text.secondary" }} />
                          </ListItem>
                        ) : (
                          filtered.map((raw) => (
                            <ListItemButton key={raw} onClick={() => handleValueToggle(raw)} dense sx={{ py: 0.25 }}>
                              <Checkbox edge="start" checked={selectedValues.has(raw)} tabIndex={-1} disableRipple size="small" />
                              <ListItemText
                                primary={formatFilterValue(raw, "date")}
                                primaryTypographyProps={{ variant: "body2", sx: { fontSize: 13 } }}
                              />
                            </ListItemButton>
                          ))
                        )}
                      </List>
                    </Box>
                  </Box>
                );
              };

              return (
                <Box>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Search dates…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{ startAdornment: <Search fontSize="small" sx={{ mr: 1, color: "action.active" }} /> }}
                    sx={{ mb: 1.5 }}
                  />
                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    <Button size="small" onClick={handleSelectAll} sx={{ textTransform: "none", fontSize: 12 }}>Select all</Button>
                    <Button size="small" onClick={handleClearAll} sx={{ textTransform: "none", fontSize: 12 }}>Clear all</Button>
                  </Stack>
                  <Box sx={{ maxHeight: 340, overflowY: "auto" }}>
                    {renderSection("Year", years)}
                    {renderSection("Month", months)}
                    {renderSection("Specific Date", dates)}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                    {selectedValues.size} of {uniqueValues.length} selected
                  </Typography>
                </Box>
              );
            }

            // Default (non-date) checkbox list
            return (
              <Box>
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

                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  <Button size="small" onClick={handleSelectAll} sx={{ textTransform: "none", fontSize: 12 }}>
                    Select all
                  </Button>
                  <Button size="small" onClick={handleClearAll} sx={{ textTransform: "none", fontSize: 12 }}>
                    Clear all
                  </Button>
                </Stack>

                <Box
                  sx={{
                    maxHeight: 300,
                    overflow: "auto",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                  }}
                >
                  <List dense sx={{ p: 0 }}>
                    {filteredCheckboxValues.length === 0 ? (
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
                      filteredCheckboxValues.map((value) => (
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
            );
          })()}

          {/* Condition Mode */}
          {filterMode === "condition" && (() => {
            // Use date-specific operators for date columns
            const activeOpts = columnType === "date" ? DATE_CONDITION_OPTIONS : CONDITION_OPTIONS;
            const activeConditionConfig = activeOpts[selectedCondition] ?? activeOpts.contains ?? Object.values(activeOpts)[0];

            return (
              <Box>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Condition</InputLabel>
                  <Select
                    value={selectedCondition in activeOpts ? selectedCondition : Object.keys(activeOpts)[0]}
                    onChange={(e) => {
                      const newCond = e.target.value as FilterCondition;
                      // If the input type changes (e.g. date → month → year), clear the stored value
                      // so stale incompatible values don't leak into the new input.
                      const oldInputType = (activeOpts as any)[selectedCondition]?.inputType;
                      const newInputType = (activeOpts as any)[newCond]?.inputType;
                      if (oldInputType !== newInputType) {
                        setConditionValue("");
                        setConditionSecondValue("");
                      }
                      setSelectedCondition(newCond);
                    }}
                    label="Condition"
                  >
                    {Object.entries(activeOpts).map(([key, { label }]) => (
                      <MenuItem key={key} value={key}>{label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {activeConditionConfig.requiresValue && (() => {
                  // For date columns, pick the right input type based on the selected operator
                  if (columnType === "date") {
                    const dateInputType = (activeConditionConfig as any).inputType ?? "date";
                    if (dateInputType === "year") {
                      return (
                        <TextField
                          fullWidth
                          size="small"
                          label="Year"
                          value={conditionValue}
                          onChange={(e) => setConditionValue(e.target.value)}
                          sx={{ mb: 2 }}
                          type="number"
                          inputProps={{ min: 2000, max: 2100, step: 1 }}
                          InputLabelProps={{ shrink: true }}
                          placeholder="e.g. 2026"
                        />
                      );
                    }
                    if (dateInputType === "month") {
                      return (
                        <TextField
                          fullWidth
                          size="small"
                          label="Month"
                          value={conditionValue}
                          onChange={(e) => setConditionValue(e.target.value)}
                          sx={{ mb: 2 }}
                          type="month"
                          InputLabelProps={{ shrink: true }}
                        />
                      );
                    }
                    // Default: exact date
                    return (
                      <TextField
                        fullWidth
                        size="small"
                        label="Date"
                        value={conditionValue}
                        onChange={(e) => setConditionValue(e.target.value)}
                        sx={{ mb: 2 }}
                        type="date"
                        InputLabelProps={{ shrink: true }}
                      />
                    );
                  }
                  // Non-date columns
                  return (
                    <TextField
                      fullWidth
                      size="small"
                      label="Value"
                      value={conditionValue}
                      onChange={(e) => setConditionValue(e.target.value)}
                      sx={{ mb: 2 }}
                      type={columnType === "number" ? "number" : "text"}
                      InputLabelProps={{ shrink: true }}
                    />
                  );
                })()}

                {activeConditionConfig.requiresSecondValue && (
                  <TextField
                    fullWidth
                    size="small"
                    label={columnType === "date" ? "End date" : "Second value"}
                    value={conditionSecondValue}
                    onChange={(e) => setConditionSecondValue(e.target.value)}
                    sx={{ mb: 2 }}
                    type={columnType === "number" ? "number" : columnType === "date" ? "date" : "text"}
                    InputLabelProps={{ shrink: true }}
                  />
                )}

                <Typography variant="caption" color="text.secondary">
                  {columnType === "date"
                    ? "Filter by a specific date, month, year, or date range"
                    : "Apply a condition-based filter to this column"}
                </Typography>
              </Box>
            );
          })()}

          <Divider sx={{ my: 2 }} />

          {/* Action Buttons */}
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="outlined" onClick={handleClearFilter} disabled={!hasActiveFilter} sx={{ textTransform: "none" }}>
              Clear filter
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={filterMode === "values" ? handleApplyCheckboxFilter : handleApplyConditionFilter}
              sx={{ textTransform: "none" }}
            >
              Apply filter
            </Button>
          </Stack>
        </Box>
      </Popover>

      <style jsx global>{`
        .sortable-ghost {
          opacity: 0.4;
          background: #e3f2fd;
        }

        .sortable-chosen {
          opacity: 1;
        }

        .sortable-drag {
          opacity: 1;
          cursor: grabbing !important;
        }

        .sortable-fallback {
          opacity: 1;
          cursor: grabbing !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transform: rotate(2deg);
        }
      `}</style>
    </>
  );
}
