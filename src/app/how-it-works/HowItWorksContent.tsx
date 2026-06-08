"use client";

import Link from "next/link";
import {
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EmailIcon from "@mui/icons-material/Email";
import SyncIcon from "@mui/icons-material/Sync";
import ForumIcon from "@mui/icons-material/Forum";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import SchoolIcon from "@mui/icons-material/School";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { CircularProjectIcon } from "@/components/circle-logo/OpleticsLogo";
import styles from "@/styles/logo.module.css";

// ─── Feature section data ────────────────────────────────────────────────────

interface Feature {
  num: string;
  icon: React.ReactNode;
  problem: string;
  problemDetail: string;
  solution: string;
  solutionDetail: string;
  chips: string[];
}

const FEATURES: Feature[] = [
  {
    num: "01",
    icon: <CalendarMonthIcon sx={{ fontSize: 28 }} />,
    problem: "Your schedule lives in too many places at once.",
    problemDetail:
      "Spreadsheets, shared drives, email threads, and handwritten notes. Every update creates a new version. Staff are working off different copies. Nothing is authoritative.",
    solution: "One organized hub for every game, team, and sport.",
    solutionDetail:
      "Import your existing schedule and it becomes the live record your entire department works from. Searchable, sortable, and always current — accessible from any device, anytime.",
    chips: ["Schedule Management", "CSV Import", "Multi-Sport"],
  },
  {
    num: "02",
    icon: <SyncIcon sx={{ fontSize: 28 }} />,
    problem: "Your calendar needs to be updated every time a game changes.",
    problemDetail:
      "Re-entering games by hand is error-prone and time-consuming. Coaches miss games because their calendar wasn't updated. Parents show up on the wrong day.",
    solution: "Every game in your schedule automatically appears in Google Calendar.",
    solutionDetail:
      "Connect once and your schedule stays in sync. Changes you make flow through automatically. Your staff, your coaches, and the parents connected to your program all see the same live picture.",
    chips: ["Google Calendar Sync", "Automatic Updates", "iPhone & Android Notifications"],
  },
  {
    num: "03",
    icon: <EmailIcon sx={{ fontSize: 28 }} />,
    problem: "Sending your schedule to hundreds of people takes longer than building it.",
    problemDetail:
      "Mail merge setups, email formatting, managing mailing lists across multiple platforms — communicating at scale with parents, coaches, and boosters is a workflow problem nobody built a good solution for.",
    solution: "Mass email campaigns built directly into your sports schedule.",
    solutionDetail:
      "Build contact groups for every audience you communicate with. Send your schedule — or any update — to all of them in seconds. No third-party tools, no formatting work, no copy-pasting.",
    chips: ["Mass Email Campaigns", "Contact Groups", "Schedule Distribution"],
  },
  {
    num: "04",
    icon: <ForumIcon sx={{ fontSize: 28 }} />,
    problem: "Scheduling games with other schools still happens by phone and email.",
    problemDetail:
      "When you have an open date to fill, you're calling other ADs cold, waiting on replies, and coordinating through inboxes with no shared context. It's slow, informal, and nothing is tracked.",
    solution: "A shared exchange where ADs post availability and connect directly.",
    solutionDetail:
      "Browse open dates from other athletic directors in your area, post your own available dates, and send game requests in one place. Built-in AD-to-AD messaging keeps the conversation organized without leaving your dashboard.",
    chips: ["Schedule Exchange", "AD Collaboration", "Game Requests", "Direct Messaging"],
  },
  {
    num: "05",
    icon: <PeopleAltIcon sx={{ fontSize: 28 }} />,
    problem: "Parents find out about cancellations and schedule changes too late.",
    problemDetail:
      "There's no direct line between your athletic program and the families following it. Parents miss games. Last-minute changes don't reach them. They're checking a website that updates once a week.",
    solution: "Parents stay connected to your live schedule — automatically.",
    solutionDetail:
      "Parents can sync your program's schedule directly to their personal calendar using a shareable access code. Send announcements to every connected parent instantly when something changes — before they drive to the wrong field.",
    chips: ["Parent Connect", "Live Schedule Sync", "Announcements"],
  },
];

// ─── Deployment options ───────────────────────────────────────────────────────

const DEPLOYMENT_OPTIONS = [
  {
    icon: <PersonOutlineIcon sx={{ fontSize: 22 }} />,
    label: "Personal Subscription",
    detail:
      "For individual athletic directors and coaches who want to run a tighter program on their own terms. Full platform access, no institution required.",
  },
  {
    icon: <SchoolIcon sx={{ fontSize: 22 }} />,
    label: "School or District Contract",
    detail:
      "For schools and athletic departments that need shared access across staff, administrators, and collaborators under one institutional account.",
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function HowItWorksContent() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* ── Minimal nav bar ── */}
      <Box
        component="header"
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          px: { xs: 2, sm: 4 },
          py: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/" className={`${styles["ad-hub-logo"]} flex`} style={{ textDecoration: "none", color: isDark ? "#fff" : "#313a4d" }}>
          <CircularProjectIcon size={22} outerStrokeWidth={2} strokeWidth={4} color={isDark ? "#fff" : "#313a4d"} />
          <span className={styles.opleticsLogoText} style={{ marginLeft: "2px", letterSpacing: "-0.65px", color: isDark ? "#fff" : "#313a4d" }}>
            opletics
          </span>
        </Link>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Button
            component={Link}
            href="/about"
            variant="text"
            size="small"
            sx={{ color: "text.secondary", textTransform: "none", fontWeight: 500 }}
          >
            About
          </Button>
          <Button
            component={Link}
            href="/onboarding/plans"
            variant="contained"
            size="small"
            sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2 }}
          >
            Get Started
          </Button>
        </Stack>
      </Box>

      {/* ── Hero ── */}
      <Box
        sx={{
          background: isDark
            ? "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)"
            : "linear-gradient(135deg, #f0f7ff 0%, #f6f8fb 100%)",
          borderBottom: "1px solid",
          borderColor: "divider",
          py: { xs: 7, md: 10 },
          px: 2,
          textAlign: "center",
        }}
      >
        <Container maxWidth="md">
          <Chip
            label="Platform Overview"
            size="small"
            sx={{ mb: 2.5, fontWeight: 600, fontSize: "0.72rem" }}
          />
          <Typography
            variant="h2"
            fontWeight={800}
            sx={{
              fontSize: { xs: "2rem", sm: "2.75rem", md: "3.25rem" },
              lineHeight: 1.15,
              mb: 2.5,
              color: "text.primary",
              letterSpacing: "-0.03em",
            }}
          >
            Athletic departments run on schedules, communication,{" "}
            <Box component="span" sx={{ color: "primary.main" }}>
              and coordination.
            </Box>
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{
              fontWeight: 400,
              maxWidth: 600,
              mx: "auto",
              lineHeight: 1.6,
              fontSize: { xs: "1rem", md: "1.125rem" },
            }}
          >
            Opletics brings all three together — one platform built specifically for athletic directors,
            coaches, and the communities they serve.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button
              component={Link}
              href="/onboarding/plans"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, px: 4 }}
            >
              Get Started Free
            </Button>
            <Button
              component={Link}
              href="/about"
              variant="outlined"
              size="large"
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2.5, px: 4 }}
            >
              About Opletics
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ── Feature sections ── */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Stack spacing={0}>
          {FEATURES.map((feature, idx) => {
            const isLast = idx === FEATURES.length - 1;
            return (
              <Box key={feature.num}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: { xs: 3, md: 8 },
                    py: { xs: 5, md: 7 },
                    alignItems: "center",
                  }}
                >
                  {/* Problem side */}
                  <Box>
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{ color: "text.disabled", letterSpacing: "0.08em", fontSize: "0.7rem" }}
                      >
                        {feature.num}
                      </Typography>
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: 2,
                          bgcolor: isDark ? "rgba(255,255,255,0.06)" : "grey.100",
                          border: "1px solid",
                          borderColor: "divider",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "text.secondary",
                        }}
                      >
                        {feature.icon}
                      </Box>
                    </Stack>

                    <Typography
                      variant="h5"
                      fontWeight={700}
                      sx={{
                        mb: 1.5,
                        lineHeight: 1.3,
                        fontSize: { xs: "1.2rem", md: "1.4rem" },
                        color: "text.primary",
                      }}
                    >
                      {feature.problem}
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                      {feature.problemDetail}
                    </Typography>
                  </Box>

                  {/* Solution side */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: { xs: 3, md: 4 },
                      borderRadius: 3,
                      border: "1px solid",
                      borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(33,150,243,0.15)",
                      background: isDark
                        ? "rgba(33,150,243,0.05)"
                        : "rgba(33,150,243,0.03)",
                    }}
                  >
                    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
                      <CheckCircleOutlineIcon sx={{ fontSize: 20, color: "primary.main", mt: 0.3, flexShrink: 0 }} />
                      <Typography
                        variant="subtitle1"
                        fontWeight={700}
                        sx={{ color: "primary.main", lineHeight: 1.35 }}
                      >
                        {feature.solution}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75, mb: 2.5 }}>
                      {feature.solutionDetail}
                    </Typography>
                    <Stack direction="row" flexWrap="wrap" gap={0.75}>
                      {feature.chips.map((chip) => (
                        <Chip
                          key={chip}
                          label={chip}
                          size="small"
                          sx={{
                            fontSize: "0.68rem",
                            height: 22,
                            fontWeight: 600,
                            bgcolor: isDark ? "rgba(33,150,243,0.15)" : "rgba(33,150,243,0.08)",
                            color: "primary.main",
                            border: "1px solid",
                            borderColor: isDark ? "rgba(33,150,243,0.3)" : "rgba(33,150,243,0.2)",
                          }}
                        />
                      ))}
                    </Stack>
                  </Paper>
                </Box>

                {!isLast && <Divider />}
              </Box>
            );
          })}
        </Stack>
      </Container>

      {/* ── Deployment options ── */}
      <Box
        sx={{
          bgcolor: isDark ? "rgba(255,255,255,0.02)" : "grey.50",
          borderTop: "1px solid",
          borderBottom: "1px solid",
          borderColor: "divider",
          py: { xs: 6, md: 8 },
          px: 2,
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h5"
            fontWeight={700}
            textAlign="center"
            sx={{ mb: 1.5, letterSpacing: "-0.02em" }}
          >
            Built for how athletic departments actually operate.
          </Typography>
          <Typography
            variant="body1"
            color="text.secondary"
            textAlign="center"
            sx={{ mb: 5, maxWidth: 520, mx: "auto", lineHeight: 1.7 }}
          >
            Opletics is available as a personal subscription for individual ADs and coaches,
            or as a school and district contract for full institutional deployment.
          </Typography>

          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={3}
            justifyContent="center"
          >
            {DEPLOYMENT_OPTIONS.map((option) => (
              <Paper
                key={option.label}
                elevation={0}
                sx={{
                  flex: 1,
                  maxWidth: { sm: 320 },
                  p: 3.5,
                  borderRadius: 3,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "background.paper",
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
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
                    }}
                  >
                    {option.icon}
                  </Box>
                  <Typography variant="subtitle2" fontWeight={700}>
                    {option.label}
                  </Typography>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                  {option.detail}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ── CTA ── */}
      <Box
        sx={{
          py: { xs: 8, md: 12 },
          px: 2,
          textAlign: "center",
        }}
      >
        <Container maxWidth="sm">
          <Typography
            variant="h4"
            fontWeight={800}
            sx={{ mb: 2, letterSpacing: "-0.03em", lineHeight: 1.2 }}
          >
            Ready to simplify your athletic department?
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4, lineHeight: 1.7 }}>
            Start free and see how much time you get back in the first week.
            No setup fees. No contracts required to try.
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="center">
            <Button
              component={Link}
              href="/onboarding/plans"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2.5, px: 5 }}
            >
              Get Started Free
            </Button>
            <Button
              component={Link}
              href="/docs"
              variant="outlined"
              size="large"
              sx={{ textTransform: "none", fontWeight: 600, borderRadius: 2.5, px: 4 }}
            >
              Read the Docs
            </Button>
          </Stack>
        </Container>
      </Box>
    </Box>
  );
}
