"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Box, Typography } from "@mui/material";
import { DynamicFeed } from "@mui/icons-material";
import ParentPostFeed from "@/components/posts/ParentPostFeed";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";

const FEED_KEY = "parent-posts-feed";

export default function ParentFeedPage() {
  const { data: session } = useSession();
  const [headerAnchor, setHeaderAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box sx={{ maxWidth: 680, mx: "auto", px: { xs: 1, sm: 2 }, py: 3 }}>
      <Box ref={setHeaderAnchor} sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <DynamicFeed sx={{ color: "primary.main", fontSize: "1.75rem" }} />
        <Typography variant="h5" fontWeight={700}>
          Feed
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Updates and posts from your school&apos;s athletic director.
      </Typography>

      <TipBubble
        tipId={TIP_IDS.PARENT_FEED}
        anchorEl={headerAnchor}
        placement="bottom-start"
        title="Stay up to date with sports news"
        body="Browse photos, recaps, and program updates posted by your school's athletic department — the latest news from your athlete's school in one place."
      />

      <ParentPostFeed
        currentParentId={session?.user?.id ?? ""}
        queryKey={FEED_KEY}
      />
    </Box>
  );
}
