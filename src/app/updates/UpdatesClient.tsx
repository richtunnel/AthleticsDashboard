"use client";

import Link from "next/link";
import {
  Box,
  Chip,
  Container,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import VerifiedIcon from "@mui/icons-material/Verified";
import GroupsIcon from "@mui/icons-material/Groups";
import BarChartIcon from "@mui/icons-material/BarChart";
import FavoriteOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import PhoneIphoneIcon from "@mui/icons-material/PhoneIphone";
import CheckIcon from "@mui/icons-material/Check";
import { CircularProjectIcon } from "@/components/circle-logo/OpleticsLogo";
import styles from "@/styles/logo.module.css";

// ── Existing features (currently live) ──────────────────────────────────────
const EXISTING_FEATURES = [
  "CSV schedule import & live spreadsheet",
  "Google Calendar sync",
  "Email campaigns & contact groups",
  "Community posts & announcements",
  "Parent portal & parent connections",
  "Schedule Exchange Board & game requests",
  "AI Travel Times",
  "Cost & Budget tracking",
  "Multi-user collaborators",
];

// ── Upcoming v1.2 features ───────────────────────────────────────────────────
interface UpcomingFeature {
  icon: React.ReactNode;
  label: string;
  headline: string;
  body: string;
  bullets: string[];
}

const UPCOMING: UpcomingFeature[] = [
  {
    icon: <PersonOutlineIcon sx={{ fontSize: 28 }} />,
    label: "Athlete Profiles",
    headline: "Every athlete. One complete record.",
    body: "Right now your athlete information is split across spreadsheets, email threads, and paper forms — each owned by a different person. Opletics v1.2 introduces centralized athlete profiles that bring academic standing, sport history, onboarding documents, and health records into one place your entire department can rely on. No more chasing down files. No more duplicate data entry. One source of truth for every student-athlete on your roster.",
    bullets: [
      "Academic history and eligibility status in one view",
      "Onboarding documents and digital e-signatures",
      "Historical sport participation and roster records",
      "Role-based access so the right staff see the right data",
    ],
  },
  {
    icon: <VerifiedIcon sx={{ fontSize: 28 }} />,
    label: "Compliance & Eligibility",
    headline: "Eligibility shouldn't be a last-minute scramble.",
    body: "Compliance mistakes don't just cost time — they can cost games, seasons, and careers. Opletics is building compliance and eligibility tools that remove the guesswork. Instead of manual transcript reviews and paper time logs, your department will have automated checks that flag concerns early, store required documents in a centralized auditable format, and generate the reports your administrators need when it matters most.",
    bullets: [
      "Automated eligibility checks with early-warning flags",
      "Centralized document storage with audit trail",
      "Time log tracking aligned with divisional requirements",
      "Exportable compliance reports for administrative review",
    ],
  },
  {
    icon: <GroupsIcon sx={{ fontSize: 28 }} />,
    label: "Recruiting Pipeline",
    headline: "From first contact to signed commitment — all in one place.",
    body: "Recruiting doesn't happen in a vacuum, but most departments manage it that way. Coaches track prospects in their own notes, admissions works from its own system, and athletic directors have no real-time visibility into where the pipeline stands. Opletics v1.2 brings recruiting into the platform — giving coaches, athletic directors, and institutional leaders a shared view of every prospect from initial outreach to roster confirmation.",
    bullets: [
      "Prospect profiles with contact history and status tracking",
      "Pipeline visibility for coaches and athletic directors",
      "Alignment with enrollment forecasting and admissions goals",
      "Communication logging tied directly to each recruit",
    ],
  },
  {
    icon: <BarChartIcon sx={{ fontSize: 28 }} />,
    label: "Analytics & Reporting",
    headline: "Real decisions need real data.",
    body: "Spreadsheet exports and manual tallies don't cut it anymore. Athletic directors and institutional leaders need accurate, up-to-date information to manage programs, allocate resources, and demonstrate value. Opletics v1.2 introduces a reporting layer built specifically for athletic administration — surfacing participation trends, program metrics, budget utilization, and compliance status in one place, without the manual work of pulling it together yourself.",
    bullets: [
      "Real-time program and participation dashboards",
      "Budget tracking and cost reporting by sport",
      "Compliance status summaries for leadership review",
      "Exportable reports for board and administrative presentations",
    ],
  },
  {
    icon: <FavoriteOutlinedIcon sx={{ fontSize: 28 }} />,
    label: "Health & Risk Oversight",
    headline: "Athlete wellbeing is part of the schedule.",
    body: "Training load, injury history, and health clearances are critical to a well-run program — yet most departments track this in separate binders or siloed systems that no one else can access. Opletics is building structured health record management that sits alongside your scheduling data, giving medical and training staff the ability to log athlete health information, track workloads over time, and flag concerns before they become problems.",
    bullets: [
      "Structured health record storage for medical and training staff",
      "Workload monitoring alongside practice and game schedules",
      "Clearance status tracking for participation authorization",
      "Centralized injury history accessible by authorized staff",
    ],
  },
  {
    icon: <SyncAltIcon sx={{ fontSize: 28 }} />,
    label: "SIS Integration",
    headline: "Stop re-entering data your school already has.",
    body: "Your student information system already knows who is enrolled, academically eligible, and in good standing. But that data rarely finds its way into your athletic department without someone manually bridging the gap. Opletics v1.2 will connect directly with leading student information systems so that enrollment status, academic records, and eligibility data sync automatically — cutting out the manual import cycle that eats up hours every week.",
    bullets: [
      "Direct sync with major student information systems",
      "Automatic academic and enrollment status updates",
      "Eligibility alerts driven by live academic data",
      "Reduced manual data entry across departments",
    ],
  },
  {
    icon: <PhoneIphoneIcon sx={{ fontSize: 28 }} />,
    label: "Mobile Experience for Athletes",
    headline: "Athletes are already on their phones. Meet them there.",
    body: "Your athletes don't check email. They check their phones. Opletics is building a dedicated mobile experience for student-athletes — giving them a single place to view their game and practice schedules, access forms, read announcements from coaches and athletic directors, and stay connected to their program. No more confusion about where to look. The same platform your staff uses will put the right information directly in athletes' hands.",
    bullets: [
      "Game and practice schedule visibility for student-athletes",
      "Push notifications for schedule changes and announcements",
      "Form access and digital completion on mobile",
      "Personalized communication from coaches and program staff",
    ],
  },
];

export default function UpdatesClient() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: isDark ? "background.default" : "#f8f9fa",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Box
        component="header"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          bgcolor: isDark ? "background.paper" : "#fff",
          borderBottom: "1px solid",
          borderColor: "divider",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        <Container maxWidth="lg" sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5 }}>
          <Link href="/" style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
            <CircularProjectIcon size={20} outerStrokeWidth={2} strokeWidth={4} color={isDark ? "#ceff77" : "#313a4d"} />
            <Typography variant="body1" fontWeight={700} sx={{ letterSpacing: "-0.5px", color: isDark ? "text.primary" : "#313a4d" }}>
              opletics
            </Typography>
          </Link>
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            <ArrowBackIcon sx={{ fontSize: 16, color: "text.secondary" }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              Back to home
            </Typography>
          </Link>
        </Container>
      </Box>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 4, md: 6 } }}>
        <Chip
          label="PLATFORM UPDATES"
          size="small"
          sx={{
            mb: 3,
            bgcolor: theme.palette.primary.main,
            color: "white",
            fontWeight: 700,
            fontSize: "0.7rem",
            letterSpacing: "1px",
            textTransform: "uppercase",
          }}
        />
        <Typography
          variant="h2"
          sx={{
            fontWeight: 800,
            fontSize: { xs: "2rem", md: "3rem" },
            lineHeight: 1.15,
            mb: 3,
            color: "text.primary",
            maxWidth: 720,
          }}
        >
          Building the operating system for athletic departments.
        </Typography>
        <Typography
          variant="body1"
          sx={{
            fontSize: { xs: "1rem", md: "1.125rem" },
            color: "text.secondary",
            maxWidth: 680,
            lineHeight: 1.7,
            mb: 4,
          }}
        >
          Opletics started as a schedule management tool — and it still does that better than anything else. But scheduling is just the beginning. Here&apos;s what we&apos;re building next.
        </Typography>

        {/* What's already live */}
        <Box
          sx={{
            bgcolor: isDark ? "rgba(255,255,255,0.04)" : "#f0fdf4",
            border: "1px solid",
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "#bbf7d0",
            borderRadius: 3,
            p: { xs: 2.5, md: 3 },
            maxWidth: 720,
          }}
        >
          <Typography variant="overline" sx={{ fontWeight: 700, color: isDark ? "#86efac" : "#16a34a", letterSpacing: 1, fontSize: "0.7rem" }}>
            Already live in v1.x
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
            {EXISTING_FEATURES.map((f) => (
              <Box key={f} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <CheckIcon sx={{ fontSize: 13, color: isDark ? "#86efac" : "#16a34a" }} />
                <Typography variant="body2" sx={{ color: "text.secondary", fontSize: "0.8rem" }}>
                  {f}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>

      <Divider />

      {/* ── Upcoming features ──────────────────────────────────────────── */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
          <Chip
            label="COMING IN v1.2"
            size="small"
            sx={{
              bgcolor: isDark ? "rgba(206,255,119,0.15)" : "rgba(22,163,74,0.1)",
              color: isDark ? "#ceff77" : "#15803d",
              fontWeight: 700,
              fontSize: "0.7rem",
              letterSpacing: "1px",
              border: "1px solid",
              borderColor: isDark ? "rgba(206,255,119,0.3)" : "rgba(22,163,74,0.25)",
            }}
          />
        </Box>
        <Typography
          variant="h4"
          sx={{ fontWeight: 700, mb: 2, fontSize: { xs: "1.5rem", md: "2rem" }, color: "text.primary" }}
        >
          What&apos;s next for Opletics
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 8, maxWidth: 560, lineHeight: 1.7 }}>
          The features below are actively in development. They represent the next phase of Opletics — expanding from schedule management into a full athletic department operating system.
        </Typography>

        <Stack spacing={0} divider={<Divider sx={{ borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />}>
          {UPCOMING.map((feature, index) => (
            <Box
              key={feature.label}
              sx={{
                py: { xs: 5, md: 7 },
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
                gap: { xs: 3, md: 8 },
                alignItems: "start",
              }}
            >
              {/* Left — label + icon */}
              <Box>
                <Box
                  sx={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    bgcolor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                    color: "text.primary",
                    mb: 2,
                  }}
                >
                  {feature.icon}
                </Box>
                <Typography variant="overline" sx={{ display: "block", fontWeight: 700, letterSpacing: 1, fontSize: "0.7rem", color: "text.secondary", mb: 0.5 }}>
                  {String(index + 1).padStart(2, "0")}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: "1rem", color: "text.primary", lineHeight: 1.3 }}>
                  {feature.label}
                </Typography>
                <Chip
                  label="Coming Soon"
                  size="small"
                  sx={{
                    mt: 1.5,
                    height: 22,
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    bgcolor: isDark ? "rgba(206,255,119,0.1)" : "rgba(22,163,74,0.08)",
                    color: isDark ? "#ceff77" : "#15803d",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(206,255,119,0.2)" : "rgba(22,163,74,0.2)",
                  }}
                />
              </Box>

              {/* Right — content */}
              <Box>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: "1.25rem", md: "1.5rem" },
                    lineHeight: 1.25,
                    mb: 2.5,
                    color: "text.primary",
                  }}
                >
                  {feature.headline}
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    color: "text.secondary",
                    lineHeight: 1.8,
                    mb: 3.5,
                    fontSize: { xs: "0.9rem", md: "1rem" },
                  }}
                >
                  {feature.body}
                </Typography>
                <Stack spacing={1.5}>
                  {feature.bullets.map((bullet) => (
                    <Box key={bullet} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
                      <Box
                        sx={{
                          mt: "3px",
                          width: 18,
                          height: 18,
                          borderRadius: "50%",
                          flexShrink: 0,
                          bgcolor: isDark ? "rgba(206,255,119,0.15)" : "rgba(22,163,74,0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <CheckIcon sx={{ fontSize: 11, color: isDark ? "#ceff77" : "#15803d" }} />
                      </Box>
                      <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6, fontSize: "0.9rem" }}>
                        {bullet}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
            </Box>
          ))}
        </Stack>
      </Container>

      {/* ── Footer CTA ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          bgcolor: isDark ? "background.paper" : "#0f172a",
          color: "white",
          py: { xs: 8, md: 12 },
          mt: 4,
        }}
      >
        <Container maxWidth="md" sx={{ textAlign: "center" }}>
          <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", letterSpacing: 2, fontSize: "0.7rem" }}>
            Opletics v1.2
          </Typography>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1.75rem", md: "2.5rem" },
              lineHeight: 1.2,
              mt: 1.5,
              mb: 2.5,
              color: "white",
            }}
          >
            The complete platform is almost here.
          </Typography>
          <Typography variant="body1" sx={{ color: "rgba(255,255,255,0.65)", mb: 5, maxWidth: 520, mx: "auto", lineHeight: 1.7 }}>
            Start with the scheduling tools your department needs today. The compliance, recruiting, and analytics features coming in v1.2 will be available to every active account — no migration required.
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", gap: 2, flexWrap: "wrap" }}>
            <Link
              href="/onboarding/plans"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 28px",
                backgroundColor: "#ceff77",
                color: "#0f172a",
                borderRadius: 12,
                fontWeight: 700,
                fontSize: "0.95rem",
                textDecoration: "none",
              }}
            >
              Get started free
            </Link>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 28px",
                backgroundColor: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
                borderRadius: 12,
                fontWeight: 600,
                fontSize: "0.95rem",
                textDecoration: "none",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
            >
              Back to home
            </Link>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
