"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, Divider, Tab, Tabs, Typography, useTheme } from "@mui/material";
import { Newspaper, Campaign, CalendarMonth, Inbox } from "@mui/icons-material";
import { useQueryClient } from "@tanstack/react-query";
import PostComposer from "@/components/posts/PostComposer";
import NewsFeed from "@/components/posts/NewsFeed";
import { AnnouncementComposer } from "@/components/announcements/AnnouncementComposer";
import AnnouncementFeed from "@/components/announcements/AnnouncementFeed";
import { TipBubble } from "@/components/tips/TipBubble";
import { TIP_IDS } from "@/components/tips/tipIds";
import { SchedulePostTab }   from "@/components/schedule-board/SchedulePostTab";
import { GameRequestsPanel } from "@/components/game-requests/GameRequestsPanel";
import { GameRequestUnreadBadge } from "@/components/game-requests/GameRequestUnreadBadge";

const POSTS_KEY         = "dashboard-posts-feed";
const ANNOUNCEMENTS_KEY = "dashboard-announcements-feed";

export default function PostsPage() {
  const { data: session } = useSession();
  const queryClient       = useQueryClient();
  const theme             = useTheme();
  const searchParams      = useSearchParams();
  const isDark            = theme.palette.mode === "dark";
  const dividerColor      = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  // Allow ?tab=3 deep-link from Game Center pill
  const initialTab = parseInt(searchParams.get("tab") ?? "0", 10);
  const [tab, setTab] = useState(isNaN(initialTab) ? 0 : Math.min(initialTab, 3));

  const [postsTabEl, setPostsTabEl] = useState<HTMLElement | null>(null);
  const [annTabEl,   setAnnTabEl]   = useState<HTMLElement | null>(null);

  const currentUser = {
    id:    session?.user?.id   ?? "",
    name:  session?.user?.name ?? null,
    image: session?.user?.image ?? null,
  };

  const TAB_DESCRIPTIONS: Record<number, { heading: string; sub: string }> = {
    0: {
      heading: "Posts",
      sub:     "Post and share updates with the community and connected parents.",
    },
    1: {
      heading: "Announcements",
      sub:     "Share time-sensitive updates directly to connected parents.",
    },
    2: {
      heading: "Post Schedule",
      sub:     "Select a league from your worksheet — we'll scan for every open date and publish it to the Exchange Board.",
    },
    3: {
      heading: "Game Requests",
      sub:     "Review and manage incoming game requests from the Schedule Exchange Board.",
    },
  };

  return (
    <Box sx={{ maxWidth: 992, mx: "auto", px: { xs: "10px", sm: 2 }, py: 3 }}>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5, fontSize: { xs: "1.15rem", sm: "1.5rem" } }}>
        {TAB_DESCRIPTIONS[tab]?.heading ?? "Posts"}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: { xs: "0.8rem", sm: "0.875rem" } }}>
        {TAB_DESCRIPTIONS[tab]?.sub ?? ""}
      </Typography>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab ref={setPostsTabEl} icon={<Newspaper fontSize="small" />} iconPosition="start" label="Posts" />
        <Tab ref={setAnnTabEl}   icon={<Campaign  fontSize="small" />} iconPosition="start" label="Announcements" />
        <Tab icon={<CalendarMonth fontSize="small" />} iconPosition="start" label="Post Schedule" />
        <Tab
          iconPosition="start"
          icon={
            <GameRequestUnreadBadge>
              <Inbox fontSize="small" />
            </GameRequestUnreadBadge>
          }
          label="Game Requests"
        />
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

      {tab === 2 && <SchedulePostTab />}

      {tab === 3 && <GameRequestsPanel context="posts" mode="all" />}
    </Box>
  );
}
