"use client";

import { Box, Button, Divider, Stack, Typography } from "@mui/material";
import ChatIcon from "@mui/icons-material/Chat";
import NextLink  from "next/link";
import { ParentsAndAthletesMenu } from "@/components/parents/ParentsAndAthletesMenu";

export default function ParentsAndAthletesPage() {
  return (
    <Box>
      <Box sx={{ px: { xs: 1, sm: 2 }, pt: 1, pb: 2 }}>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 0.25 }}>Connect Hub</Typography>
        <Typography variant="h6" fontWeight={500} color="text.secondary" sx={{ mb: 0.5 }}>
          Parents Connect
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Manage parent connections, athlete links, and direct messaging.
        </Typography>
      </Box>
      <ParentsAndAthletesMenu defaultOpen={true} />

      <Divider sx={{ my: 3, borderColor: "divider", borderBottomWidth: "0.5px" }} />

      {/* Chat — formerly a top-level nav item, now lives here */}
      <Box sx={{ px: { xs: 1, sm: 2 }, pb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Messages
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Direct messaging with connected parents and collaborators.
            </Typography>
          </Box>
          <Button
            component={NextLink}
            href="/dashboard/messages"
            variant="outlined"
            startIcon={<ChatIcon fontSize="small" />}
            sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
          >
            Open Chat
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
