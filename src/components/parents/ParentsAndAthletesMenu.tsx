"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Badge,
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
} from "@mui/material";
import { 
  ExpandLess, 
  ExpandMore, 
  Person, 
  CalendarMonth, 
  Group,
  ContentCopy,
  Refresh,
  Check,
  Link as LinkIcon,
} from "@mui/icons-material";
import { ConnectedParentsMenu } from "../parents/ConnectedParentsMenu";

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

async function fetchPendingCount(): Promise<{ pendingRequests: unknown[] }> {
  const res = await fetch("/api/parent-schedule-mappings/pending");
  if (!res.ok) return { pendingRequests: [] };
  return res.json();
}

export function ParentsAndAthletesMenu({ defaultOpen = false }: ParentsAndAthletesMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const { data: shareData, isLoading, error, refetch } = useQuery({
    queryKey: ["shareCode"],
    queryFn: fetchShareCode,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: pendingData } = useQuery({
    queryKey: ["pendingParentRequests"],
    queryFn: fetchPendingCount,
    staleTime: 2 * 60 * 1000,
  });
  const pendingCount = pendingData?.pendingRequests?.length || 0;

  const handleToggle = () => {
    setOpen(!open);
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
    <Card variant="outlined" sx={{ mb: 2 }}>
      <ListItemButton onClick={handleToggle}>
        <ListItemIcon>
          <Badge badgeContent={pendingCount} color="warning" max={99}>
            <Person color="primary" />
          </Badge>
        </ListItemIcon>
        <ListItemText
          primary="Parents & Athletes"
          secondary={pendingCount > 0 ? `${pendingCount} pending request${pendingCount > 1 ? 's' : ''}` : "Manage parent connections"}
        />
        {open ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Box sx={{ p: 2, pt: 0 }}>
          <ConnectedParentsMenu />
          
          <Divider sx={{ my: 2 }} />
          
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
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Share link unavailable. You can still use the button below to open the parent signup page.
              </Typography>
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
                      }
                    }}
                  />
                  <Tooltip title={copied ? "Copied!" : "Copy link"}>
                    <IconButton 
                      onClick={handleCopyLink} 
                      color={copied ? "success" : "default"}
                      size="small"
                    >
                      {copied ? <Check /> : <ContentCopy />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Generate new code">
                    <IconButton 
                      onClick={handleRegenerateCode} 
                      size="small"
                    >
                      <Refresh />
                    </IconButton>
                  </Tooltip>
                </Box>
                
                <Typography variant="caption" color="text.secondary">
                  Share Code: <Box component="span" sx={{ fontFamily: "monospace", fontWeight: "bold" }}>{shareData.shareCode}</Box>
                </Typography>
                
                {shareData.schoolName && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    School: {shareData.schoolName}
                  </Typography>
                )}
              </>
            ) : null}
          </Box>

          <Button
            fullWidth
            variant="contained"
            startIcon={<Group />}
            onClick={() => {
              if (shareData?.shareUrl) {
                // Open the share URL in a new tab
                window.open(shareData.shareUrl, "_blank");
              } else {
                // Fallback to the generic parent signup
                window.open("/onboarding/parent-signup", "_blank");
              }
            }}
            disabled={isLoading}
          >
            Open Parent Portal Link
          </Button>
        </Box>
      </Collapse>
    </Card>
  );
}
