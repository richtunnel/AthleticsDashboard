"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  IconButton,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  Stack,
  Chip,
} from "@mui/material";
import { Email, Sms, ContentCopy, Close, Share, EmojiEvents } from "@mui/icons-material";

interface ReferralShareDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function ReferralShareDialog({ open, onClose }: ReferralShareDialogProps) {
  const [referralLink, setReferralLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [stats, setStats] = useState<{
    totalReferrals: number;
    currentPoints: number;
  } | null>(null);

  useEffect(() => {
    if (open) {
      fetchReferralLink();
      fetchStats();
    }
  }, [open]);

  const fetchReferralLink = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/referrals/my-link");
      if (!res.ok) {
        throw new Error("Failed to fetch referral link");
      }
      const data = await res.json();
      setReferralLink(data.referralLink);
    } catch (err) {
      console.error("Error fetching referral link:", err);
      setError("Failed to load referral link");
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/referrals/stats");
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalReferrals: data.totalReferrals,
          currentPoints: data.currentPoints,
        });
      }
    } catch (err) {
      console.error("Error fetching stats:", err);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopySuccess(true);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent("Join me on Athletics Director Hub");
    const body = encodeURIComponent(
      `Hi! I'm using Athletics Director Hub to manage my athletic program and I think you'd love it too.\n\nSign up using my referral link and we both get rewards:\n${referralLink}`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  };

  const handleSmsShare = () => {
    const message = encodeURIComponent(`Join me on Athletics Director Hub! Sign up with my link and we both get rewards: ${referralLink}`);

    // Check if mobile device
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      window.open(`sms:?body=${message}`, "_blank");
    } else {
      // On desktop, just copy the link
      handleCopyLink();
      alert("Link copied to clipboard! Share it via text message on your phone.");
    }
  };

  const handleCloseCopySnackbar = () => {
    setCopySuccess(false);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Share color="primary" />
              <Typography variant="h6">Refer a Friend</Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Share your referral link and earn rewards when your friends sign up!
          </Typography>

          {stats && (
            <Box
              sx={{
                mb: 3,
                p: 2,
                bgcolor: "primary.50",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Your Reward Points
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <EmojiEvents sx={{ color: "primary.main" }} />
                  <Typography variant="h5" color="primary">
                    {stats.currentPoints}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    points
                  </Typography>
                </Box>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="body2" color="text.secondary">
                  Referrals
                </Typography>
                <Typography variant="h5" color="text.primary">
                  {stats.totalReferrals}
                </Typography>
              </Box>
            </Box>
          )}

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Your Referral Link
                </Typography>
                <TextField
                  fullWidth
                  value={referralLink}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <IconButton onClick={handleCopyLink} edge="end" color="primary">
                        <ContentCopy />
                      </IconButton>
                    ),
                  }}
                  size="small"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Share via
              </Typography>

              <Stack spacing={1.5}>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Email />}
                  onClick={handleEmailShare}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  Email
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<Sms />}
                  onClick={handleSmsShare}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  SMS / Text Message
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<ContentCopy />}
                  onClick={handleCopyLink}
                  sx={{ textTransform: "none" }}
                >
                  Copy Link
                </Button>
              </Stack>

              <Box sx={{ mt: 3, p: 2, bgcolor: "grey.50", borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  <strong>Earn 100 points</strong> for each friend who signs up using your link!
                </Typography>
              </Box>
            </>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copySuccess}
        autoHideDuration={3000}
        onClose={handleCloseCopySnackbar}
        message="Link copied to clipboard!"
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
