"use client";

import { useState } from "react";
import { Box, Typography, Stack, Chip, Button, Divider, Card, CardContent } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SchoolIcon from "@mui/icons-material/School";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import SearchIcon from "@mui/icons-material/Search";
import GroupsIcon from "@mui/icons-material/Groups";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import PersonIcon from "@mui/icons-material/Person";
import DirectionsBusIcon from "@mui/icons-material/DirectionsBus";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import TuneIcon from "@mui/icons-material/Tune";
import PostAddIcon from "@mui/icons-material/PostAdd";
import Link from "next/link";

// ── Callout components ────────────────────────────────────────────────────────

type CalloutType = "note" | "important" | "learning";

function Callout({ type, children }: { type: CalloutType; children: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const config = {
    note: {
      icon: <InfoOutlinedIcon sx={{ fontSize: 16 }} />,
      label: "Note",
      bg: isDark ? "rgba(251,191,36,0.1)" : "rgba(251,191,36,0.12)",
      color: isDark ? "#fbbf24" : "#92400e",
      border: "rgba(251,191,36,0.35)",
    },
    important: {
      icon: <WarningAmberIcon sx={{ fontSize: 16 }} />,
      label: "Important",
      bg: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.08)",
      color: isDark ? "#f87171" : "#991b1b",
      border: "rgba(239,68,68,0.3)",
    },
    learning: {
      icon: <SchoolIcon sx={{ fontSize: 16 }} />,
      label: "Learning",
      bg: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.08)",
      color: isDark ? "#93c5fd" : "#1e40af",
      border: "rgba(59,130,246,0.3)",
    },
  } as const;

  const c = config[type];
  return (
    <Box
      sx={{
        mt: 1.5,
        px: 1.5,
        py: 1,
        borderRadius: 1.5,
        bgcolor: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      {/* Icon + label on one line, vertically centered */}
      <Stack direction="row" alignItems="center" gap={0.5} sx={{ mb: 0.3 }}>
        <Box sx={{ color: c.color, display: "flex", alignItems: "center", flexShrink: 0 }}>{c.icon}</Box>
        <Typography variant="caption" fontWeight={700} sx={{ color: c.color, lineHeight: 1 }}>
          {c.label}
        </Typography>
      </Stack>
      {/* Body text: no extra indent, flush with card padding */}
      <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.55 }}>
        {children}
      </Typography>
    </Box>
  );
}

// ── Tip card ──────────────────────────────────────────────────────────────────

interface Tip {
  num: number;
  icon: React.ReactNode;
  title: string;
  tag: string;
  body: string;
  callouts: { type: CalloutType; text: string }[];
  href?: string;
  cta?: string;
}

function TipCard({ tip }: { tip: Tip }) {
  const theme = useTheme();
  return (
    <Card
      elevation={0}
      sx={{
        height: "100%",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        transition: "box-shadow 0.15s ease",
        "&:hover": {
          boxShadow: theme.palette.mode === "dark" ? "0 4px 20px rgba(0,0,0,0.35)" : "0 4px 20px rgba(0,0,0,0.07)",
        },
      }}
    >
      <CardContent sx={{ flex: 1, p: { xs: 2, sm: 2.5 } }}>
        {/* Header */}
        <Stack direction="row" alignItems="flex-start" gap={1.5} sx={{ mb: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              bgcolor: "primary.main",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: "1rem",
            }}
          >
            {tip.icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
              <Typography variant="caption" color="text.disabled" fontWeight={600}>
                {String(tip.num).padStart(2, "0")}
              </Typography>
              <Chip label={tip.tag} size="small" sx={{ fontSize: "0.62rem", height: 18 }} />
            </Stack>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 0.25 }}>
              {tip.title}
            </Typography>
          </Box>
        </Stack>

        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          {tip.body}
        </Typography>

        {tip.callouts.map((c, i) => (
          <Callout key={i} type={c.type}>
            {c.text}
          </Callout>
        ))}
      </CardContent>

      {tip.href && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <Button component={Link} href={tip.href} size="small" variant="outlined" sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}>
            {tip.cta ?? "Open →"}
          </Button>
        </Box>
      )}
    </Card>
  );
}

// ── Tip data ──────────────────────────────────────────────────────────────────

const PRIMARY_TIPS: Tip[] = [
  {
    num: 1,
    icon: <UploadFileIcon sx={{ fontSize: 18 }} />,
    title: "Import Your Schedule",
    tag: "Getting Started",
    body: "Start by importing a CSV file of your sports schedule — this is the foundation everything else builds on. The system mirrors your data exactly, keeping your schedule accurate and up to date.",
    callouts: [{ type: "note", text: "Game Center includes pre-built column filters so you can slice and sort your schedule the moment it's imported." }],
    href: "/dashboard/games",
    cta: "Go to Game Center →",
  },
  {
    num: 2,
    icon: <CalendarMonthIcon sx={{ fontSize: 18 }} />,
    title: "Organize Your Schedule",
    tag: "Game Center",
    body: "After importing, use the Change View button above the table in Game Center to switch to calendar view. Drag columns, apply filters, and sort by sport, date, or level to match exactly how you think.",
    callouts: [{ type: "learning", text: "You can view your imported csv worksheet as a calendar in week or months for clarity." }],
    href: "/dashboard/games",
    cta: "Open Game Center →",
  },
  {
    num: 3,
    icon: <EmailIcon sx={{ fontSize: 18 }} />,
    title: "Email Your Schedule",
    tag: "Email Manager",
    body: "Build email campaigns in Email Manager and blast your schedule to all contacts in just a few clicks. Hide irrelevant columns, swap campaigns, and change recipients — all without leaving the same screen.",
    callouts: [{ type: "note", text: "No copy-pasting or manual formatting needed. The platform handles layout and distribution automatically." }],
    href: "/dashboard/email-groups",
    cta: "Open Email Manager →",
  },
  {
    num: 4,
    icon: <EmailIcon sx={{ fontSize: 18 }} />,
    title: "Email Signature",
    tag: "Email Manager",
    body: "Your school email is automatically applied as the reply-to address on every outgoing email. Add your school name, logo, and contact details to the signature — the system takes care of delivery and formatting. Use the built-in rich text toolbar to bold key text or adjust font size for a polished look.",
    callouts: [
      { type: "important", text: "An incomplete signature can reduce email deliverability. Fill in your details before sending any campaigns." },
      { type: "note", text: "Select any text in the Signature Text editor and click B to make it bold, or choose Small / Normal / Large / X-Large from the size menu." },
    ],
    href: "/dashboard/email-groups",
    cta: "Set Up Signature →",
  },
  {
    num: 5,
    icon: <EditCalendarIcon sx={{ fontSize: 18 }} />,
    title: "Calendar Sync",
    tag: "Calendars",
    body: "Connect your Google Calendar and sync your entire imported schedule to it in one step. Game reminders land in your existing calendar workflow automatically.",
    callouts: [{ type: "important", text: "Your CSV must include both a date column and a time column for sync to work. Missing times will result in all-day events without reminders." }],
    href: "/dashboard/gsync",
    cta: "Connect Calendar →",
  },
  {
    num: 6,
    icon: <SearchIcon sx={{ fontSize: 18 }} />,
    title: "Schedule Exchange",
    tag: "Find Games",
    body: "Browse ADs in your district, see their open schedule dates, and request games directly — no phone calls or emails required.",
    callouts: [{ type: "learning", text: "Your district is shown first by default. Add your district in Settings → School Details to enable this filtering." }],
    href: "/schedule-board",
    cta: "Open Exchange Board →",
  },
  {
    num: 7,
    icon: <AutoAwesomeIcon sx={{ fontSize: 18 }} />,
    title: "Find Available Dates (AI)",
    tag: "AI Features",
    body: "Use the natural language AI tool in Game Center to scan your schedule and surface open dates that match specific criteria — sport, level, time of year, or day of the week.",
    callouts: [{ type: "learning", text: 'Try: "Find open Fridays in November for Varsity Football." Our AI reads your live schedule data.' }],
    href: "/dashboard/games",
    cta: "Try It →",
  },
];

const MORE_TIPS: Tip[] = [
  {
    num: 8,
    icon: <PersonIcon sx={{ fontSize: 18 }} />,
    title: "Parent Connect",
    tag: "Connect",
    body: "Parents can sync your game schedule directly to their Google or Apple Calendar using a shareable access code from the Connect page. Approve or revoke parent connections from your dashboard at any time.",
    callouts: [{ type: "note", text: "Parents never see your administrative data — they only see the public-facing game schedule you share." }],
    href: "/dashboard/parents",
    cta: "Open Connect →",
  },
  {
    num: 9,
    icon: <DirectionsBusIcon sx={{ fontSize: 18 }} />,
    title: "Bus Scheduling",
    tag: "AI Features",
    body: "Enable Enhanced Travel Time in Settings → AI Features. Enter your target arrival time for any away game and the system calculates your departure time, factoring in live traffic, current weather, and a configurable safety buffer.",
    callouts: [
      {
        type: "important",
        text: "Enhanced Travel Time requires you to input the time you'd like the team to arrive at the destination. If you run into any errors make sure that you're using the correct addresses. Contact support if further assistance needed.",
      },
    ],
    href: "/dashboard/settings",
    cta: "Enable in Settings →",
  },
  {
    num: 10,
    icon: <GroupsIcon sx={{ fontSize: 18 }} />,
    title: "Collaborators",
    tag: "Settings",
    body: "Add an assistant AD, coach, or staff member as a collaborator to help manage your schedule. Each collaborator gets their own login with role-based permissions controlling what they can view or edit.",
    callouts: [{ type: "note", text: "Collaborator activity is tracked separately so you always know who changed what." }],
    href: "/dashboard/settings",
    cta: "Manage Collaborators →",
  },
  {
    num: 11,
    icon: <NewspaperIcon sx={{ fontSize: 18 }} />,
    title: "Community",
    tag: "Community",
    body: "Post general updates for athletes and parents in the community feed, send time-sensitive announcements directly to parents' dashboards, and publish your availability on the Exchange Board so nearby ADs can find you.",
    callouts: [
      {
        type: "learning",
        text: "Announcements go straight to connected parents — use them for urgent changes like cancellations or location updates. Community posts are visible to your broader network.",
      },
    ],
    href: "/dashboard/posts",
    cta: "Go to Community →",
  },
  {
    num: 12,
    icon: <TuneIcon sx={{ fontSize: 18 }} />,
    title: "Hide Menu Options",
    tag: "Settings → Other",
    body: "Streamline your sidebar by hiding menu items you don't use regularly. Toggle any item off in Settings → Other → Hide Menu Options and it disappears from the navigation instantly.",
    callouts: [
      { type: "note", text: "Hiding a menu item only removes the sidebar shortcut — your data is never deleted and can be restored by toggling it back on at any time." },
      { type: "learning", text: "Currently toggleable: Community, Connect, and Find Games." },
    ],
    href: "/dashboard/settings",
    cta: "Open Settings →",
  },
  {
    num: 13,
    icon: <TuneIcon sx={{ fontSize: 18 }} />,
    title: "Column Identity — Sync Your CSV Columns",
    tag: "Settings → Other",
    body: "When you import a CSV, Opletics automatically tries to detect which column holds your opponent or away team names. If it can't match it automatically, use Column Identity in Settings → Other to manually point your column to the right field. Once mapped, your Calendar View and table will both show the correct team names instead of TBD.",
    callouts: [
      { type: "note", text: "Column Identity also shows you which columns were auto-detected for date, time, and home/away — so you always know how your data is being read." },
      { type: "learning", text: "If more than 5 games show TBD as the opponent, a banner will appear in Calendar View guiding you to sync the correct column." },
    ],
    href: "/dashboard/settings",
    cta: "Open Settings → Other →",
  },
  {
    num: 14,
    icon: <PostAddIcon sx={{ fontSize: 18 }} />,
    title: "Post Schedule Quick Link",
    tag: "Game Center",
    body: "Enable a Post Schedule button inside Game Center so you can post your open dates to the Schedule Exchange Board without leaving your schedule. Toggle it on in Settings → Other → Post Schedule Quick Link.",
    callouts: [
      { type: "note", text: "The button is hidden by default — you can turn it o in Settings." },
      { type: "learning", text: "After posting, keep your eyes out for a response in chat and in your email." },
    ],
    href: "/dashboard/settings",
    cta: "Enable in Settings →",
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FeatureTipsPage() {
  const [showMore, setShowMore] = useState(false);

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", px: { xs: 2, sm: 3 }, py: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.5 }}>
        <LightbulbOutlinedIcon color="primary" sx={{ fontSize: 28 }} />
        <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: "1.25rem", sm: "1.5rem" } }}>
          Feature Tips
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 560 }}>
        A quick walkthrough of the most-used features — learn how each one works and where to find it.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      {/* Primary tips */}
      <Stack spacing={2.5}>
        {PRIMARY_TIPS.map((tip) => (
          <TipCard key={tip.num} tip={tip} />
        ))}
      </Stack>

      {/* See More */}
      {!showMore ? (
        <Box sx={{ textAlign: "center", mt: 4 }}>
          <Button variant="outlined" endIcon={<KeyboardArrowDownIcon />} onClick={() => setShowMore(true)} sx={{ textTransform: "none", fontWeight: 600, borderRadius: 3, px: 3 }}>
            See More Features
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            6 more tips
          </Typography>
        </Box>
      ) : (
        <Box sx={{ mt: 3 }}>
          <Divider sx={{ mb: 3 }}>
            <Chip label="More Features" size="small" />
          </Divider>
          <Stack spacing={2.5}>
            {MORE_TIPS.map((tip) => (
              <TipCard key={tip.num} tip={tip} />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
