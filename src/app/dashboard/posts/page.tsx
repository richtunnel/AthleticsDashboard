"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Box, Divider, Tab, Tabs, Typography, useTheme } from "@mui/material";
import { Newspaper, Campaign } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import PostComposer from "@/components/posts/PostComposer";
import NewsFeed from "@/components/posts/NewsFeed";
import { AnnouncementComposer } from "@/components/announcements/AnnouncementComposer";
import AnnouncementFeed from "@/components/announcements/AnnouncementFeed";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";

const POSTS_KEY = "dashboard-posts-feed";
const ANNOUNCEMENTS_KEY = "dashboard-announcements-feed";

export default function PostsPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const dividerColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";
  const [tab, setTab] = useState(0);
  // Anchors per tab — each tip stays anchored to its own tab button, and only
  // renders while that tab is active so the two bubbles never compete.
  const [postsTabEl, setPostsTabEl] = useState<HTMLElement | null>(null);
  const [annTabEl, setAnnTabEl] = useState<HTMLElement | null>(null);

  const currentUser = {
    id: session?.user?.id ?? "",
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
  };

  return (
    <Box sx={{ maxWidth: 992, mx: "auto", px: { xs: "10px", sm: 2 }, py: 3 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5, fontSize: { xs: "1.15rem", sm: "1.5rem" } }}>
        Posts
      </Typography>

      {tab === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
          Post and share updates with the community and connected parents.
        </Typography>
      )}

      {tab === 1 && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
          Share updates directly to connected parents.
        </Typography>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }}>
        <Tab ref={setPostsTabEl} icon={<Newspaper fontSize="small" />} iconPosition="start" label="Posts" />
        <Tab ref={setAnnTabEl} icon={<Campaign fontSize="small" />} iconPosition="start" label="Announcements" />
      </Tabs>

      <TipBubble
        tipId={TIP_IDS.POSTS_TAB}
        anchorEl={tab === 0 ? postsTabEl : null}
        placement="bottom-start"
        title="Share community updates"
        body="Posts appear in the community news feed for athletes, coaches, and parents who follow your program — the place for general updates, photos, and news."
      />
      <TipBubble
        tipId={TIP_IDS.ANNOUNCEMENTS_TAB}
        anchorEl={tab === 1 ? annTabEl : null}
        placement="bottom-start"
        title="Send direct announcements"
        body="Announcements go straight to connected parents' dashboards — use them for time-sensitive updates like cancellations, location changes, or weather delays."
      />

      {tab === 0 && (
        <>
          {session?.user && <PostComposer currentUser={currentUser} onPostCreated={() => queryClient.invalidateQueries({ queryKey: [POSTS_KEY] })} />}
          <Divider sx={{ mb: 3, borderColor: dividerColor, borderBottomWidth: "0.5px" }} />
          <NewsFeed currentUserId={session?.user?.id} queryKey={POSTS_KEY} />
        </>
      )}

      {tab === 1 && (
        <>
          {session?.user && <AnnouncementComposer currentUser={currentUser} onCreated={() => queryClient.invalidateQueries({ queryKey: [ANNOUNCEMENTS_KEY] })} />}
          <Divider sx={{ mb: 3, borderColor: dividerColor, borderBottomWidth: "0.5px" }} />
          <AnnouncementFeed currentUserId={session?.user?.id} queryKey={ANNOUNCEMENTS_KEY} />
        </>
      )}
    </Box>
  );
}
