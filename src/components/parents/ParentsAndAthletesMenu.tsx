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
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";
import {} from "@mui/icons-material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

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
  // Anchors for the three per-tab onboarding tips. Each bubble only renders
  // while its own tab is active so they never overlap each other.
  const [syncTabEl, setSyncTabEl] = useState<HTMLElement | null>(null);
  const [connectedTabEl, setConnectedTabEl] = useState<HTMLElement | null>(null);
  const [portalTabEl, setPortalTabEl] = useState<HTMLElement | null>(null);

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
    <Box sx={{ px: { xs: "10px", sm: 2 }, pb: 3, pt: 0 }}>
      <Typography sx={{ mb: 0, fontWeight: 600, fontSize: { xs: "1.35rem", sm: "1.5rem" } }} variant="h5">
        Parent Connect
      </Typography>

      <Typography sx={{ mb: 2 }} variant="body2" color="text.secondary">
        Manage parent connections, athlete links, and direct messaging.
        <span>
          <Tooltip
            placement="top"
            arrow
            title="Allow parents to sync game schedules with your worksheet. Approve the sync request, then select the columns that match the student's sport and level (e.g., Varsity, JV, or Freshman)"
          >
            <IconButton size="small" sx={{ ml: 0, pl: 0 }}>
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </span>
      </Typography>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ p: 2, pt: 1 }}>
            <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }} variant="scrollable" scrollButtons="auto">
              <Tab
                ref={setSyncTabEl}
                icon={
                  <Badge badgeContent={pendingCount} color="error" max={99}>
                    <HowToReg fontSize="small" />
                  </Badge>
                }
                iconPosition="start"
                label="Sync Requests"
              />
              <Tab ref={setConnectedTabEl} icon={<Group fontSize="small" />} iconPosition="start" label="Connected Parents" />
              <Tab ref={setPortalTabEl} icon={<LinkIcon fontSize="small" />} iconPosition="start" label="Parent Setup" />
            </Tabs>

            <TipBubble
              tipId={TIP_IDS.PARENTS_SYNC_REQUESTS}
              anchorEl={tabValue === 0 ? syncTabEl : null}
              placement="bottom-start"
              title="Approve calendar sync requests"
              body="Parents request access here so they can sync their child's game schedule to their personal Google Calendar. Review each request and approve the sport and level they should see."
            />
            <TipBubble
              tipId={TIP_IDS.PARENTS_CONNECTED}
              anchorEl={tabValue === 1 ? connectedTabEl : null}
              placement="bottom-start"
              title="Manage connected parents"
              body="Every parent currently syncing to your schedule appears here. Remove a parent at any time to immediately revoke their calendar access."
            />
            <TipBubble
              tipId={TIP_IDS.PARENTS_PORTAL_SETUP}
              anchorEl={tabValue === 2 ? portalTabEl : null}
              placement="bottom-end"
              title="Invite parents with one link"
              body="Share your unique portal URL with parents — they'll be able to create an account, link their athlete, and request calendar sync in just a few clicks."
            />

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
