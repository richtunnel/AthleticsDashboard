"use client";

import { useSession } from "next-auth/react";
import { Box, Typography, Alert } from "@mui/material";
import { Campaign } from "@mui/icons-material";
import AnnouncementFeed from "@/components/announcements/AnnouncementFeed";

const FEED_KEY = "parent-announcements-feed";

export default function ParentAnnouncementsPage() {
  const { data: session } = useSession();

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: { xs: 1, sm: 2 }, py: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <Campaign sx={{ color: "primary.main", fontSize: "1.75rem" }} />
        <Typography variant="h5" fontWeight={700}>
          Announcements
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Stay up to date with important messages from your school&apos;s athletic program.
      </Typography>

      <AnnouncementFeed
        currentUserId={session?.user?.id}
        queryKey={FEED_KEY}
        apiPath="/api/parent/announcements"
        showSchool
      />
    </Box>
  );
}
