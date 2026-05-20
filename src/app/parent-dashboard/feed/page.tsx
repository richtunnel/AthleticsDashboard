"use client";

import { useSession } from "next-auth/react";
import { Box, Typography } from "@mui/material";
import { DynamicFeed } from "@mui/icons-material";
import ParentPostFeed from "@/components/posts/ParentPostFeed";

const FEED_KEY = "parent-posts-feed";

export default function ParentFeedPage() {
  const { data: session } = useSession();

  return (
    <Box sx={{ maxWidth: 680, mx: "auto", px: { xs: 1, sm: 2 }, py: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
        <DynamicFeed sx={{ color: "primary.main", fontSize: "1.75rem" }} />
        <Typography variant="h5" fontWeight={700}>
          Feed
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Updates and posts from your school's athletic director.
      </Typography>

      <ParentPostFeed
        currentParentId={session?.user?.id ?? ""}
        queryKey={FEED_KEY}
      />
    </Box>
  );
}
