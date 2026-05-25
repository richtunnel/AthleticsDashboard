"use client";

import { useState } from "react";
import { Card, CardContent, Typography, Button, CircularProgress, Snackbar, Alert } from "@mui/material";
import { TipsAndUpdates } from "@mui/icons-material";

/**
 * TutorialTipsCard
 *
 * Settings → Other entry that clears every dismissed onboarding tip so the
 * TipBubbles re-appear on the user's next visit to each page. Calls the
 * reset endpoint directly (no TipsContext required) so this card can also
 * be rendered on Server Component pages.
 *
 * `apiBase` defaults to the AD endpoint. The parent dashboard passes
 * "/api/parent/tips" so the reset hits the parent-session-scoped route.
 *
 * Note: the TipsProvider cache on other open tabs won't see the reset until
 * those tabs reload — that's intentional. The query has `staleTime: Infinity`
 * to avoid re-renders during normal use; full reconciliation happens on the
 * next mount, which is what the user expects after clicking "Show again".
 */
export interface TutorialTipsCardProps {
  apiBase?: string;
}

export function TutorialTipsCard({ apiBase = "/api/user/tips" }: TutorialTipsCardProps = {}) {
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<{ open: boolean; msg: string; sev: "success" | "error" }>({
    open: false,
    msg: "",
    sev: "success",
  });

  const handleReset = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBase}/reset`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reset");
      setSnack({
        open: true,
        msg: "Tutorial tips will show again next time you visit each page.",
        sev: "success",
      });
    } catch (err) {
      setSnack({
        open: true,
        msg: err instanceof Error ? err.message : "Failed to reset tutorial tips",
        sev: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card sx={{ mb: 3, boxShadow: "none!important" }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" }, display: "flex", alignItems: "center", gap: 1 }}>
            <TipsAndUpdates sx={{ color: "primary.main" }} fontSize="small" />
            Tutorial Tips
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
            Show the onboarding hint bubbles again (Import, Calendar Connect, Email Groups, and more). They appear once on first use and disappear after you click &quot;Got it&quot;.
          </Typography>
          <Button
            variant="outlined"
            onClick={handleReset}
            disabled={busy}
            startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <TipsAndUpdates />}
            sx={{ textTransform: "none" }}
          >
            {busy ? "Resetting…" : "Show tutorial tips again"}
          </Button>
        </CardContent>
      </Card>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snack.sev}
          variant="filled"
          onClose={() => setSnack((s) => ({ ...s, open: false }))}
          sx={{ width: "100%" }}
        >
          {snack.msg}
        </Alert>
      </Snackbar>
    </>
  );
}
