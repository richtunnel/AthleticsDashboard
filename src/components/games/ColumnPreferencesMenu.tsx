"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReactSortable } from "react-sortablejs";
import { Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import { Close, DragIndicator, DeleteOutline } from "@mui/icons-material";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

interface ColumnMenuItem {
  id: string;
  label: string;
  visible: boolean;
  disableHide?: boolean;
  disableDelete?: boolean;
}

interface ColumnPreferencesMenuProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnMenuItem[];
  onToggleVisibility: (columnId: string, visible: boolean) => void;
  onReorder: (order: string[]) => void;
  onShowAll: () => void;
  onDeleteColumn?: (columnId: string) => void;
}

export function ColumnPreferencesMenu({ open, onClose, columns, onToggleVisibility, onReorder, onShowAll, onDeleteColumn }: ColumnPreferencesMenuProps) {
  const [items, setItems] = useState<ColumnMenuItem[]>([]);
  const previousOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (open) {
      setItems(columns);
      previousOrderRef.current = columns.map((column) => column.id);
    }
  }, [columns, open]);

  const allVisible = useMemo(() => items.every((item) => item.visible), [items]);
  const visibleCount = useMemo(() => items.filter((item) => item.visible).length, [items]);

  const handleSetList = (newList: ColumnMenuItem[]) => {
    setItems(newList);
    const newOrder = newList.map((item) => item.id);
    if (!ordersMatch(previousOrderRef.current, newOrder)) {
      previousOrderRef.current = newOrder;
      onReorder(newOrder);
    }
  };

  const handleToggle = (column: ColumnMenuItem) => {
    if (column.disableHide && column.visible) {
      return;
    }

    if (column.visible && visibleCount <= 1) {
      return;
    }

    const nextVisible = !column.visible;
    const nextItems = items.map((item) => (item.id === column.id ? { ...item, visible: nextVisible } : item));
    setItems(nextItems);
    onToggleVisibility(column.id, nextVisible);
  };

  const handleShowAll = () => {
    if (allVisible) {
      return;
    }
    const nextItems = items.map((item) => ({ ...item, visible: true }));
    setItems(nextItems);
    onShowAll();
  };

  const handleDelete = (columnId: string) => {
    if (!onDeleteColumn) return;
    
    if (confirm("Are you sure you want to delete this column? This action cannot be undone.")) {
      onDeleteColumn(columnId);
      // Remove from local items list
      const nextItems = items.filter((item) => item.id !== columnId);
      setItems(nextItems);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1, fontWeight: 600 }}>
        Customize Columns
        <IconButton onClick={onClose} size="small">
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag to reorder columns, use checkboxes to toggle visibility, and delete unwanted columns.
        </Typography>
        <ReactSortable list={items} setList={handleSetList} animation={200} handle=".drag-handle">
          {items.map((column) => (
            <Stack
              key={column.id}
              direction="row"
              alignItems="center"
              spacing={1.5}
              sx={{
                py: 1,
                px: 1.5,
                mb: 1,
                borderRadius: 1,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <Checkbox checked={column.visible} onChange={() => handleToggle(column)} disabled={(column.disableHide && column.visible) || (column.visible && visibleCount <= 1)} />
              <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: 500 }}>
                {column.label}
              </Typography>
              {!column.disableDelete && onDeleteColumn && (
                <IconButton 
                  size="small" 
                  onClick={() => handleDelete(column.id)}
                  sx={{ 
                    color: "error.main",
                    "&:hover": { 
                      bgcolor: "error.light",
                      color: "error.dark" 
                    }
                  }}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              )}
              <IconButton size="small" className="drag-handle">
                <DragIndicator fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </ReactSortable>
        {!allVisible && (
          <Box sx={{ mt: 1 }}>
            <Button size="small" onClick={handleShowAll} sx={{ textTransform: "none", px: 0 }}>
              Show all columns
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={() => {
            trackEvent("Customize Columns Done Clicked", {
              source: "column_preferences_menu",
              action: "done_customize_columns",
              visible_columns_count: items.filter(item => item.visible).length,
              total_columns_count: items.length,
            });
            onClose();
          }} 
          variant="contained"
        >
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ordersMatch(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
