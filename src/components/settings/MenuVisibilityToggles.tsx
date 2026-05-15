"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Chat, Newspaper, Person } from "@mui/icons-material";

interface MenuVisibility {
  hideChatMenu: boolean;
  hidePostsMenu: boolean;
  hideParentsMenu: boolean;
}

async function fetchMenuVisibility(): Promise<MenuVisibility> {
  const res = await fetch("/api/user/menu-visibility");
  if (!res.ok) throw new Error("Failed to fetch menu visibility settings");
  return res.json();
}

async function updateMenuVisibility(patch: Partial<MenuVisibility>): Promise<MenuVisibility> {
  const res = await fetch("/api/user/menu-visibility", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update menu visibility");
  return res.json();
}

interface MenuItemToggleProps {
  label: string;
  description: string;
  tooltip: string;
  icon: React.ReactNode;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

function MenuItemToggle({ label, description, tooltip, icon, checked, disabled, onChange }: MenuItemToggleProps) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2 }}>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, flexGrow: 1 }}>
        <Box sx={{ color: "text.secondary", mt: 0.25 }}>{icon}</Box>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="body1" fontWeight={500}>
              {label}
            </Typography>
            <Tooltip title={tooltip} placement="top" arrow>
              <IconButton size="small">
                <InfoOutlinedIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: "0.8rem" }}>
            {description}
          </Typography>
        </Box>
      </Box>
      <FormControlLabel
        control={
          <Switch
            checked={checked}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
          />
        }
        label=""
        sx={{ mr: 0 }}
      />
    </Box>
  );
}

export function MenuVisibilityToggles() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["menuVisibility"],
    queryFn: fetchMenuVisibility,
    staleTime: 5 * 60 * 1000,
  });

  const mutation = useMutation({
    mutationFn: updateMenuVisibility,
    onSuccess: (updated) => {
      queryClient.setQueryData(["menuVisibility"], (prev: MenuVisibility | undefined) => ({
        ...prev,
        ...updated,
      }));
      // Also invalidate the layout query so the sidebar updates
      queryClient.invalidateQueries({ queryKey: ["menuVisibility"] });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <CircularProgress size={20} />
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      </Box>
    );
  }

  // "show" = not hidden; toggles are ON when item is visible
  const showChat = !(data?.hideChatMenu ?? false);
  const showPosts = !(data?.hidePostsMenu ?? false);
  const showParents = !(data?.hideParentsMenu ?? false);

  const items = [
    {
      key: "hideChatMenu" as const,
      label: "Chat",
      description: "Direct messaging between ADs and collaborators.",
      tooltip: "When hidden, the Chat menu item will no longer appear in the sidebar. Your messages are preserved and can be restored by re-enabling this option.",
      icon: <Chat fontSize="small" />,
      checked: showChat,
    },
    {
      key: "hidePostsMenu" as const,
      label: "Posts",
      description: "Community news feed for sharing updates with fellow ADs.",
      tooltip: "When hidden, the Posts menu item will no longer appear in the sidebar. The public news feed at /news is unaffected — this only hides your dashboard shortcut.",
      icon: <Newspaper fontSize="small" />,
      checked: showPosts,
    },
    {
      key: "hideParentsMenu" as const,
      label: "Parents",
      description: "Parent & athlete portal access and communication tools.",
      tooltip: "When hidden, the Parents menu item will no longer appear in the sidebar. Parent portal access codes remain active — this only removes the dashboard shortcut.",
      icon: <Person fontSize="small" />,
      checked: showParents,
    },
  ];

  return (
    <Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
        {items.map((item, idx) => (
          <Box key={item.key}>
            {idx > 0 && <Divider sx={{ mb: 2.5 }} />}
            <MenuItemToggle
              label={item.label}
              description={item.description}
              tooltip={item.tooltip}
              icon={item.icon}
              checked={item.checked}
              disabled={mutation.isPending}
              onChange={(visible) =>
                mutation.mutate({ [item.key]: !visible })
              }
            />
          </Box>
        ))}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
