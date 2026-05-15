"use client";

import { useSession } from "next-auth/react";
import { Box, Divider, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import PostComposer from "@/components/posts/PostComposer";
import NewsFeed from "@/components/posts/NewsFeed";

const FEED_KEY = "dashboard-posts-feed";

export default function PostsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();

  const currentUser = {
    id: session?.user?.id ?? "",
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
  };

  const handlePostCreated = () => {
    queryClient.invalidateQueries({ queryKey: [FEED_KEY] });
  };

  return (
    <Box sx={{ maxWidth: 680, mx: "auto", px: { xs: 1, sm: 2 }, py: 3 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
        Posts
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Share updates, news, and moments with the AthleticsHub community.
      </Typography>

      {session?.user && (
        <PostComposer currentUser={currentUser} onPostCreated={handlePostCreated} />
      )}

      <Divider sx={{ mb: 3 }} />

      <NewsFeed currentUserId={session?.user?.id} queryKey={FEED_KEY} />
    </Box>
  );
}
