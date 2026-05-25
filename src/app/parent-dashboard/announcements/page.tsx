"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Box, Typography, Alert } from "@mui/material";
import { Campaign } from "@mui/icons-material";
import AnnouncementFeed from "@/components/announcements/AnnouncementFeed";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";

const FEED_KEY = "parent-announcements-feed";

export default function ParentAnnouncementsPage() {
  const { data: session } = useSession();
  const [headerAnchor, setHeaderAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box sx={{ maxWidth: 760, mx: "auto", px: { xs: 1, sm: 2 }, py: 3 }}>
      <Box ref={setHeaderAnchor} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <Campaign sx={{ color: "primary.main", fontSize: "1.75rem" }} />
        <Typography variant="h5" fontWeight={700}>
          Announcements
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Stay up to date with important messages from your school&apos;s athletic program.
      </Typography>

      <TipBubble
        tipId={TIP_IDS.PARENT_ANNOUNCEMENTS}
        anchorEl={headerAnchor}
        placement="bottom-start"
        title="Important updates from the athletic department"
        body="See time-sensitive announcements the moment they're posted — cancellations, schedule changes, weather delays, and other notices that affect your athlete."
      />

      <AnnouncementFeed
        currentUserId={session?.user?.id}
        queryKey={FEED_KEY}
        apiPath="/api/parent/announcements"
        showSchool
      />
    </Box>
  );
}
