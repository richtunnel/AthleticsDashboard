"use client";

import { Card, CardContent, Typography, Box, Button } from "@mui/material";
import { useRouter } from "next/navigation";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import { useTheme as customTheme } from "@mui/material/styles";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

export function SupportCard() {
  const router = useRouter();
  const theme = customTheme();
  const { mode } = useTheme();

  return (
    <Card sx={{ mb: 3, boxShadow: "none!important" }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <SupportAgentIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" sx={{ fontSize: { xs: "1.125rem", md: "1.25rem" } }}>
            Support & Help
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: { xs: "0.875rem", md: "0.875rem" } }}>
          Need assistance? Our support team is here to help you. Create a ticket and we&apos;ll respond within 48 hours.
        </Typography>
        <Button
          variant="contained"
          startIcon={<ConfirmationNumberIcon />}
          onClick={() => {
            trackEvent("Support Tickets Clicked", {
              source: "settings_page",
              action: "open_support_tickets",
            });
            router.push("/dashboard/support");
          }}
          sx={{ textTransform: "none", color: mode === "dark" ? "#000" : "#fff" }}
        >
          Support Tickets
        </Button>
      </CardContent>
    </Card>
  );
}
