"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Divider,
  TextField,
  IconButton,
  Alert,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
} from "@mui/material";
import { ExpandLess, ExpandMore, Person, CalendarMonth, Share, ContentCopy, Refresh, Check, Link as LinkIcon, Group, HowToReg } from "@mui/icons-material";
import Badge from "@mui/material/Badge";
import { ConnectedParentsMenu } from "../parents/ConnectedParentsMenu";
import { CalendarSyncRequestsMenu } from "./CalendarSyncRequestsMenu";

interface ParentsAndAthletesMenuProps {
  defaultOpen?: boolean;
}

interface ShareCodeData {
  shareCode: string;
  shareUrl: string;
  userName: string | null;
  schoolName: string | null;
  organizationName: string | null;
}

async function fetchShareCode(): Promise<ShareCodeData> {
  const res = await fetch("/api/parent/share-code");
  if (!res.ok) throw new Error("Failed to fetch share code");
  return res.json();
}

async function regenerateShareCode(): Promise<ShareCodeData> {
  const res = await fetch("/api/parent/share-code", { method: "POST" });
  if (!res.ok) throw new Error("Failed to regenerate share code");
  return res.json();
}

export function ParentsAndAthletesMenu({ defaultOpen = false }: ParentsAndAthletesMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  const {
    data: shareData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shareCode"],
    queryFn: fetchShareCode,
    staleTime: 5 * 60 * 1000,
  });

  // Badge count for pending sync requests
  const { data: syncRequestsData } = useQuery({
    queryKey: ["adminCalendarSyncRequests"],
    queryFn: async () => {
      const res = await fetch("/api/admin/calendar-sync-requests");
      if (!res.ok) return { requests: [] };
      return res.json() as Promise<{ requests: Array<{ status: string }> }>;
    },
    staleTime: 60 * 1000,
  });
  const pendingCount = (syncRequestsData?.requests ?? []).filter((r) => r.status === "PENDING").length;

  const handleToggle = () => {
    setOpen(!open);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleCopyLink = async () => {
    if (!shareData?.shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareData.shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleRegenerateCode = async () => {
    try {
      await regenerateShareCode();
      refetch();
    } catch (err) {
      console.error("Failed to regenerate code:", err);
    }
  };

  return (
    <Box sx={{ px: { xs: 2, sm: 3 }, pb: 3, pt: 0 }}>
      <Typography sx={{ mb: 2, fontWeight: 700 }} variant="h4">
        Parents Connect
      </Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ p: 2, pt: 1 }}>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                icon={
                  <Badge badgeContent={pendingCount} color="error" max={99}>
                    <HowToReg fontSize="small" />
                  </Badge>
                }
                iconPosition="start"
                label="Sync Requests"
              />
              <Tab icon={<Group fontSize="small" />} iconPosition="start" label="Connected Parents" />
              <Tab icon={<LinkIcon fontSize="small" />} iconPosition="start" label="Portal Setup" />
            </Tabs>

            {tabValue === 0 && <CalendarSyncRequestsMenu />}
            
            {tabValue === 1 && <ConnectedParentsMenu />}
            
            {tabValue === 2 && (
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <LinkIcon color="primary" />
                  <Typography variant="subtitle1" fontWeight={600}>
                    Share Parent Portal Link
                  </Typography>
                </Box>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Share this unique link with parents to let them easily connect to your school&apos;s athletic program.
                </Typography>

                {isLoading ? (
                  <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : error ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Failed to load share link. Please try again.
                  </Alert>
                ) : shareData ? (
                  <>
                    <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
                      <TextField
                        fullWidth
                        size="small"
                        value={shareData.shareUrl}
                        InputProps={{
                          readOnly: true,
                        }}
                        sx={{
                          "& .MuiInputBase-input": {
                            fontFamily: "monospace",
                            fontSize: "0.8rem",
                          },
                        }}
                      />
                      <Tooltip title={copied ? "Copied!" : "Copy link"}>
                        <IconButton onClick={handleCopyLink} color={copied ? "success" : "default"} size="small">
                          {copied ? <Check /> : <ContentCopy />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Generate new code">
                        <IconButton onClick={handleRegenerateCode} size="small">
                          <Refresh />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    <Typography variant="caption" color="text.secondary">
                      Share Code:{" "}
                      <Box component="span" sx={{ fontFamily: "monospace", fontWeight: "bold" }}>
                        {shareData.shareCode}
                      </Box>
                    </Typography>

                    {shareData.schoolName && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        School: {shareData.schoolName}
                      </Typography>
                    )}
                  </>
                ) : null}

                <Box sx={{ mt: 3 }}>
                  <Button
                    variant="contained"
                    startIcon={<Share />}
                    onClick={async () => {
                      const url = shareData?.shareUrl || `${window.location.origin}/onboarding/parent-signup`;
                      const shareText = `Join our athletic program! Sign up as a parent here: ${url}`;

                      if (navigator.share) {
                        try {
                          await navigator.share({
                            title: "Join Our Athletic Program",
                            text: shareText,
                            url,
                          });
                        } catch (err) {
                          if ((err as Error).name !== "AbortError") {
                            console.error("Share failed:", err);
                          }
                        }
                      } else {
                        const subject = encodeURIComponent("Join Our Athletic Program");
                        const body = encodeURIComponent(shareText);
                        window.open(`mailto:?subject=${subject}&body=${body}`, "_self");
                      }
                    }}
                    disabled={isLoading}
                    sx={{ maxWidth: 320 }}
                  >
                    Share Parent Link
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Collapse>
      </Card>
    </Box>
  );
}
