"use client";

import { useState, useCallback } from "react";
import { Box, Typography, Stack, Accordion, AccordionSummary, AccordionDetails, Chip, Button, Divider, Paper, Link as MuiLink } from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import EmailIcon from "@mui/icons-material/Email";
import PeopleIcon from "@mui/icons-material/People";
import DownloadIcon from "@mui/icons-material/Download";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import Link from "next/link";

// ── CSV template download ─────────────────────────────────────────────────────
function downloadExampleCsv() {
  const headers = ["date", "time", "sport", "level", "gender", "opponent", "home_away", "venue", "location", "status", "notes"];
  const rows = [
    ["2025-09-05", "15:00", "Basketball", "Varsity", "Boys", "Lincoln High", "Home", "Main Gym", "123 Main St, Springfield", "SCHEDULED", "Season opener"],
    ["2025-09-12", "18:30", "Soccer", "JV", "Girls", "Roosevelt HS", "Away", "Roosevelt Field", "456 Oak Ave, Shelbyville", "SCHEDULED", ""],
    ["2025-09-19", "16:00", "Football", "Varsity", "Boys", "Washington HS", "Home", "Athletic Complex", "789 Elm Rd, Springfield", "SCHEDULED", "Homecoming game"],
    ["2025-09-26", "14:00", "Volleyball", "Varsity", "Girls", "Jefferson Prep", "Away", "Jefferson Gym", "321 Pine St, Shelbyville", "SCHEDULED", ""],
  ];
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "opletics_schedule_template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Reusable step item ────────────────────────────────────────────────────────
function Step({ num, children }: { num: number; children: React.ReactNode }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  return (
    <Stack direction="row" gap={1.5} sx={{ mb: 1.25 }}>
      <Box
        sx={{
          minWidth: 22,
          height: 22,
          borderRadius: "50%",
          bgcolor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12),
          color: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "0.68rem",
          fontWeight: 800,
          flexShrink: 0,
          mt: "1px",
        }}
      >
        {num}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.7 }}>
        {children}
      </Typography>
    </Stack>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────
interface Section {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  question: string;
  content: React.ReactNode;
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function HelpPage() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [expanded, setExpanded] = useState<string | false>(false);

  const toggle = useCallback((panel: string) => (_: React.SyntheticEvent, isExpanded: boolean) => setExpanded(isExpanded ? panel : false), []);

  const accentBg = (color: string) => alpha(color, isDark ? 0.12 : 0.08);
  const accentBdr = (color: string) => alpha(color, isDark ? 0.35 : 0.25);

  const sections: Section[] = [
    // ── 1. CSV Upload ────────────────────────────────────────────────────────
    {
      id: "csv",
      icon: <UploadFileIcon />,
      label: "Spreadsheet Import",
      color: "#6366f1",
      question: "Having trouble uploading your spreadsheet?",
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.75 }}>
            The most common cause of import errors is mismatched column names. Opletics maps your CSV headers to the right fields automatically — but the columns need to follow recognisable names.
            Download our example template to see the expected format.
          </Typography>

          {/* Download CTA */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2.5,
              borderRadius: 2,
              border: "1px dashed",
              borderColor: alpha("#6366f1", 0.4),
              bgcolor: alpha("#6366f1", isDark ? 0.06 : 0.03),
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
            <Box>
              <Typography variant="subtitle2" fontWeight={700}>
                opletics_schedule_template.csv
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Includes: date, time, sport, level, gender, opponent, home/away, venue, location, status, notes
              </Typography>
            </Box>
            <Button variant="contained" size="small" startIcon={<DownloadIcon />} onClick={downloadExampleCsv} sx={{ textTransform: "none", fontWeight: 600, boxShadow: 0 }}>
              Download Template
            </Button>
          </Paper>

          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            Tips for a successful import
          </Typography>
          <Step num={1}>
            Make sure your file is saved as <strong>.csv</strong> (not .xlsx or .numbers).
          </Step>
          <Step num={2}>
            Dates should be in <strong>YYYY-MM-DD</strong> format (e.g. 2025-09-05).
          </Step>
          <Step num={3}>
            Times should be in <strong>HH:MM</strong> 24-hour format (e.g. 15:00 for 3 PM).
          </Step>
          <Step num={4}>
            For <strong>Home/Away</strong>, use values like <em>Home</em>, <em>Away</em>, <em>H</em>, or <em>A</em> in your column. A column named <em>home_away</em>, <em>Location Type</em>, or{" "}
            <em>H/A</em> is automatically detected.
          </Step>
          <Step num={5}>
            Include <strong>gender</strong> in your sport column or as a separate column (e.g. "Boys Varsity Basketball") so Calendar View and Schedule Exchange display the correct league.
          </Step>
        </Box>
      ),
    },

    // ── 2. Calendar Sync ─────────────────────────────────────────────────────
    {
      id: "calendar",
      icon: <CalendarMonthIcon />,
      label: "Calendar Sync",
      color: "#0ea5e9",
      question: "Calendar sync not working?",
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.75 }}>
            Calendar sync issues usually fall into one of four categories. Work through each step below.
          </Typography>
          <Step num={1}>
            <strong>Check your connection.</strong> Navigate to{" "}
            <MuiLink component={Link} href="/dashboard/gsync" underline="hover" sx={{ fontWeight: 600 }}>
              Calendars
            </MuiLink>{" "}
            and verify that your Google account is listed as connected. If not, click <em>Connect Google Calendar</em> and authorise Opletics.
          </Step>
          <Step num={2}>
            <strong>Look for the lock icon.</strong> In your Games table, find the sync icon at the right end of each row. A <em>lock icon</em> means the game is already synced and locked. If you see
            a plain sync icon (no lock), click it to push that game to your calendar.
          </Step>
          <Step num={3}>
            <strong>Verify your Google account.</strong> Make sure you are signed into the correct Gmail account — the one you connected inside Opletics. Syncing to a different Google account won't
            work until you reconnect with the right one.
          </Step>
          <Step num={4}>
            <strong>Check our status page.</strong> If sync is failing for all games, there may be a known incident.{" "}
            <MuiLink href="/incident-response" target="_blank" rel="noopener noreferrer" underline="hover" sx={{ fontWeight: 600 }}>
              View Incident Reports <OpenInNewIcon sx={{ fontSize: 12, verticalAlign: "middle" }} />
            </MuiLink>
          </Step>
        </Box>
      ),
    },

    // ── 3. Seeing TBD ────────────────────────────────────────────────────────
    {
      id: "tbd",
      icon: <HelpOutlineIcon />,
      label: "Showing TBD",
      color: "#f59e0b",
      question: "Seeing TBD for opponent, time, or location?",
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.75 }}>
            TBD appears when Opletics can't match a column from your imported CSV to a recognised field. The <strong>Column Identity</strong> feature lets you manually map your column names.
          </Typography>
          <Step num={1}>
            Go to{" "}
            <MuiLink component={Link} href="/dashboard/settings" underline="hover" sx={{ fontWeight: 600 }}>
              Settings → Other
            </MuiLink>{" "}
            and open the <em>Column Identity</em> panel.
          </Step>
          <Step num={2}>Select the column from your spreadsheet that holds the opponent / time / location data and map it to the correct field.</Step>
          <Step num={3}>
            Switch to <strong>Calendar View</strong> in Game Center — a banner will appear at the top guiding you through the mapping if more than 5 games show TBD.
          </Step>
          <Step num={4}>
            If TBD persists after mapping, try re-importing your CSV with clearer column headers (e.g. rename <em>"opp"</em> → <em>"Opponent"</em> or <em>"tm"</em> → <em>"Time"</em>).
          </Step>
        </Box>
      ),
    },

    // ── 4. Emails not sending ────────────────────────────────────────────────
    {
      id: "email",
      icon: <EmailIcon />,
      label: "Email Issues",
      color: "#10b981",
      question: "Emails not sending or not being received?",
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.75 }}>
            Most email delivery issues have a simple fix. Work through the steps below before contacting support.
          </Typography>
          <Step num={1}>
            <strong>Check your daily limit.</strong> Each plan has a daily sending cap. Go to{" "}
            <MuiLink component={Link} href="/dashboard/settings" underline="hover" sx={{ fontWeight: 600 }}>
              Settings → General
            </MuiLink>{" "}
            to see how many emails you've sent today. If you've hit your limit, wait until midnight UTC to reset.
          </Step>
          <Step num={2}>
            <strong>Verify recipient addresses.</strong> Remove any obviously invalid addresses from your email group (e.g. missing "@" or ".com"). Invalid addresses cause delivery failures for the
            whole batch.
          </Step>
          <Step num={3}>
            <strong>Narrow down your recipient group.</strong> If you're sending to a large group, try splitting it into smaller batches of 50–100 to isolate any problematic addresses.
          </Step>
          <Step num={4}>
            <strong>Check Email Logs.</strong> Go to{" "}
            <MuiLink component={Link} href="/dashboard/email-logs" underline="hover" sx={{ fontWeight: 600 }}>
              Email Logs
            </MuiLink>{" "}
            to see the delivery status for each send. Failed sends will show an error reason. Copy the error and{" "}
            <MuiLink component={Link} href="/dashboard/support" underline="hover" sx={{ fontWeight: 600 }}>
              send it to Support
            </MuiLink>
            .
          </Step>
        </Box>
      ),
    },

    // ── 5. Parent sync ───────────────────────────────────────────────────────
    {
      id: "parents",
      icon: <PeopleIcon />,
      label: "Parent Sync",
      color: "#ec4899",
      question: "Trouble syncing parents or parent calendar requests?",
      content: (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.75 }}>
            Parent calendar sync requires several pieces to be in place on both the AD and parent sides. Run through this checklist before escalating to support.
          </Typography>
          <Step num={1}>
            <strong>Delete and resend the request.</strong> In the{" "}
            <MuiLink component={Link} href="/dashboard/parents" underline="hover" sx={{ fontWeight: 600 }}>
              Connect Hub
            </MuiLink>
            , find the parent's sync request under <em>Sync Requests</em>, remove it, and re-approve a fresh one.
          </Step>
          <Step num={2}>
            <strong>Ask the parent to resync.</strong> Have the parent open their portal and tap <em>Resend Calendar Request</em> (or log out and back in). Sometimes a stale token is the only issue.
          </Step>
          <Step num={3}>
            <strong>Confirm your schedule is imported and your calendar is connected.</strong> Parent sync only works when you have games in Game Center <em>and</em> a Google Calendar connected on the{" "}
            <MuiLink component={Link} href="/dashboard/gsync" underline="hover" sx={{ fontWeight: 600 }}>
              Calendars
            </MuiLink>{" "}
            page.
          </Step>
          <Step num={4}>
            <strong>Check the parent's dashboard.</strong> The parent must have their own Google Calendar connected inside their parent portal dashboard. Without that, Opletics has nowhere to push the
            events.
          </Step>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ maxWidth: 860, mx: "auto", px: { xs: 2, sm: 3 }, py: { xs: 3, md: 4 } }}>
      {/* ── Page header ── */}
      <Stack direction="row" alignItems="center" gap={1.5} sx={{ mb: 0.75 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: 2.5,
            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.main",
          }}
        >
          <HelpOutlineIcon />
        </Box>
        <Box>
          <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.15 }}>
            Help Guide
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Common questions answered — step by step.
          </Typography>
        </Box>
      </Stack>

      {/* Quick-jump chips */}
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 2.5, mb: 3.5 }}>
        {sections.map((s) => (
          <Chip
            key={s.id}
            icon={<Box sx={{ color: s.color, display: "flex", "& svg": { fontSize: 16 } }}>{s.icon}</Box>}
            label={s.label}
            size="small"
            variant={expanded === s.id ? "filled" : "outlined"}
            onClick={() => setExpanded(expanded === s.id ? false : s.id)}
            sx={{
              cursor: "pointer",
              fontWeight: expanded === s.id ? 700 : 500,
              borderColor: expanded === s.id ? s.color : "divider",
              bgcolor: expanded === s.id ? alpha(s.color, isDark ? 0.18 : 0.1) : "transparent",
              color: expanded === s.id ? s.color : "text.secondary",
            }}
          />
        ))}
      </Stack>

      {/* ── Accordion items ── */}
      <Stack spacing={1.5}>
        {sections.map((s) => (
          <Accordion
            key={s.id}
            expanded={expanded === s.id}
            onChange={toggle(s.id)}
            elevation={0}
            disableGutters
            sx={{
              border: "1px solid",
              borderColor: expanded === s.id ? accentBdr(s.color) : "divider",
              borderRadius: "12px !important",
              bgcolor: expanded === s.id ? accentBg(s.color) : "background.paper",
              transition: "border-color 0.2s, background-color 0.2s",
              "&:before": { display: "none" },
              overflow: "hidden",
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon sx={{ color: expanded === s.id ? s.color : "text.disabled" }} />}
              sx={{ px: 2.5, py: 1.5, minHeight: "unset", "& .MuiAccordionSummary-content": { my: 0 } }}
            >
              <Stack direction="row" alignItems="center" gap={1.5}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: 1.5,
                    bgcolor: alpha(s.color, isDark ? 0.2 : 0.12),
                    color: s.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    "& svg": { fontSize: 18 },
                    flexShrink: 0,
                  }}
                >
                  {s.icon}
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={700} sx={{ color: s.color, display: "block", lineHeight: 1 }}>
                    {s.label}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.4, mt: 0.25 }}>
                    {s.question}
                  </Typography>
                </Box>
              </Stack>
            </AccordionSummary>

            <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
              <Divider sx={{ mb: 2, borderColor: accentBdr(s.color) }} />
              {s.content}
            </AccordionDetails>
          </Accordion>
        ))}
      </Stack>

      {/* ── Footer CTA ── */}
      <Paper
        elevation={0}
        sx={{
          mt: 4,
          p: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "divider",
          bgcolor: isDark ? "rgba(255,255,255,0.025)" : "rgba(0,0,0,0.018)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, isDark ? 0.15 : 0.08),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "primary.main",
            }}
          >
            <SupportAgentIcon />
          </Box>
          <Box>
            <Typography variant="subtitle2" fontWeight={700}>
              Still need help?
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Our team responds within 48 hours. Create a support ticket and we'll sort it out.
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" gap={1.5} flexWrap="wrap">
          <Button component="a" href="mailto:support@opletics.com" variant="outlined" size="small" startIcon={<EmailIcon fontSize="small" />} sx={{ textTransform: "none", fontWeight: 600 }}>
            Email Support
          </Button>
          <Button
            component={Link}
            href="/dashboard/support"
            variant="contained"
            size="small"
            startIcon={<SupportAgentIcon fontSize="small" />}
            sx={{ textTransform: "none", fontWeight: 600, boxShadow: 0 }}
          >
            Create a Ticket
          </Button>
        </Stack>
      </Paper>

      {/* Resolved indicator */}
      <Stack direction="row" alignItems="center" gap={0.75} sx={{ mt: 2.5, justifyContent: "center" }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 14, color: "text.disabled" }} />
        <Typography variant="caption" color="text.disabled">
          Most issues are resolved within minutes using the steps above.
        </Typography>
      </Stack>
    </Box>
  );
}
