import { Features } from "./features";
import { FiArrowRight, FiBox, FiCheck, FiCode, FiCopy, FiFlag, FiGrid, FiLock, FiSearch, FiSliders, FiSmile, FiTerminal, FiThumbsUp, FiToggleLeft, FiTrendingUp, FiUserPlus } from "react-icons/fi";
import { Box, ButtonGroup, Chip, Container, IconButton, Stack, Typography, Card, useTheme, useMediaQuery } from "@mui/material";
import Link from "next/link";
import { CalendarMonth, EmailRounded, BorderAll, ScoreboardRounded, AutoAwesomeRounded, DepartureBoard } from "@mui/icons-material";

export const FeaturesSection = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Create features array with conditional icon properties
  const featuresConfig = [
    {
      title: (
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            background: "rgba(39, 45, 96, 0.95)",
            color: "white",
            border: "none",
            height: "100%",
          }}
        >
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 1 }}>
            <CalendarMonth sx={{ mr: 1, fontSize: 24, color: "white" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>
              Calendar Sync
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "white", mb: 1, display: { xs: "none", md: "block" } }}>
            Calendar Sync
          </Typography>
          <Chip
            label="INTEGRATIONS"
            size="small"
            sx={{
              mb: 2,
              backgroundColor: "rgba(255,255,255,0.2)",
              color: "white",
              fontSize: "0.7rem",
              fontWeight: 600,
              border: "1px solid #fff",
            }}
          />
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
            Automatically sync your game schedules to your calendar, no more manual typing.
          </Typography>
        </Card>
      ),
      icon: CalendarMonth,
      description: "",
      variant: "inline",
    },
    {
      title: (
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            background: "rgba(39, 45, 96, 0.95)",
            color: "white",
            border: "none",
            height: "100%",
          }}
        >
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 1 }}>
            <EmailRounded sx={{ mr: 1, fontSize: 24, color: "white" }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: "white" }}>
              Bulk Email
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, color: "white", mb: 1, display: { xs: "none", md: "block" } }}>
            Bulk Email
          </Typography>
          <Chip
            label="COMMUNICATIONS"
            size="small"
            sx={{
              mb: 2,
              backgroundColor: "rgba(255,255,255,0.2)",
              color: "white",
              fontSize: "0.7rem",
              fontWeight: 600,
              border: "1px solid #fff",
            }}
          />
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)" }}>
            Quickly email your game schedules using our advanced campaign manager and email tracking.
          </Typography>
        </Card>
      ),
      icon: EmailRounded,
      description: "",
      variant: "inline",
    },
    {
      title: (
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : "#fff",
            border: `1px solid ${theme.palette.divider}`,
            height: "100%",
          }}
        >
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 1 }}>
            <FiSearch style={{ marginRight: 8, fontSize: 24, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Find Dates
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: { xs: "none", md: "block" } }}>
            Find Dates
          </Typography>
          <Chip
            label="SCHEDULING"
            size="small"
            sx={{
              mb: 2,
              backgroundColor: "rgba(25, 118, 210, 0.1)",
              color: theme.palette.primary.main,
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          />
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Use our search tool to find available dates for games using natural language.
          </Typography>
        </Card>
      ),
      icon: FiSearch,
      description: "",
      variant: "inline",
    },
    {
      title: (
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : "#fff",
            border: `1px solid ${theme.palette.divider}`,
            height: "100%",
          }}
        >
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 1 }}>
            <BorderAll sx={{ mr: 1, fontSize: 24, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Spreadsheet
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: { xs: "none", md: "block" } }}>
            Spreadsheet
          </Typography>
          <Chip
            label="DATA MANAGEMENT"
            size="small"
            sx={{
              mb: 2,
              backgroundColor: "rgba(25, 118, 210, 0.1)",
              color: theme.palette.primary.main,
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          />
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            After importing your game schedule spreadsheet use our digital spreadsheet to filter, search, sort, reorder and edit your data.
          </Typography>
        </Card>
      ),
      icon: BorderAll,
      description: "",
      variant: "inline",
    },
    {
      title: (
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : "#fff",
            border: `1px solid ${theme.palette.divider}`,
            height: "100%",
          }}
        >
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 1 }}>
            <DepartureBoard sx={{ mr: 1, fontSize: 24, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Travel Time
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: { xs: "none", md: "block" } }}>
            Travel Time
          </Typography>
          <Chip
            label="BUS DEPARTURE"
            size="small"
            sx={{
              mb: 2,
              backgroundColor: "rgba(25, 118, 210, 0.1)",
              color: theme.palette.primary.main,
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          />
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            Don't waste time thinking about time. Our predictive traffic feature recommends the best time to depart from campus.
          </Typography>
        </Card>
      ),
      icon: DepartureBoard,
      description: "",
      variant: "inline",
    },
    {
      title: (
        <Card
          sx={{
            p: 3,
            borderRadius: 3,
            backgroundColor: theme.palette.mode === "dark" ? theme.palette.background.paper : "#fff",
            border: `1px solid ${theme.palette.divider}`,
            height: "100%",
          }}
        >
          <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", mb: 1 }}>
            <AutoAwesomeRounded sx={{ mr: 1, fontSize: 24, color: theme.palette.primary.main }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              AI Assistant
            </Typography>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, display: { xs: "none", md: "block" } }}>
            AI Assistant
          </Typography>
          <Chip
            label="AUTOMATION"
            size="small"
            sx={{
              mb: 2,
              backgroundColor: "rgba(25, 118, 210, 0.1)",
              color: theme.palette.primary.main,
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          />
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            We have artificial intelligence features that help you find traveling times, email generation and schedule conflicts.
          </Typography>
        </Card>
      ),
      icon: AutoAwesomeRounded,
      description: "",
      variant: "inline",
    },
  ];

  return (
    <Features
      id="features"
      title={
        <Typography
          variant="h3"
          sx={{
            lineHeight: "short",
            fontSize: { xs: "2xl", lg: "4xl" },
            textAlign: "left",
            fontWeight: "700",
          }}
        >
          Made for Directors,
          <br /> Coaches and Staff.
        </Typography>
      }
      description={
        <>
          Opletics includes a ton of useful features for athletic departments.
          <br />
          We've helped athletic directors shave off over 60% of their daily workflow.
        </>
      }
      align="left"
      columns={{ xs: 1, sm: 2, md: 3 }}
      iconSize={isMobile ? 0 : 32}
      features={featuresConfig.map(({ icon, ...rest }) => ({
        ...rest,
        ...(isMobile ? {} : { icon }), // Only include icon on desktop
      }))}
    />
  );
};
