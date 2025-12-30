import React from "react";
import { Box, Container, Typography, GridLegacy as Grid, Button, useTheme } from "@mui/material";
import { CheckCircle, Schedule, Notifications, Sync, CalendarMonth, People, AutoAwesome, Send, DepartureBoard } from "@mui/icons-material";

const SolutionSection = () => {
  const theme = useTheme();

  const features = [
    {
      icon: <CalendarMonth />,
      title: "Calendar Integration",
      description: "Sync games directly to your personal calendar with one click.",
    },
    {
      icon: <AutoAwesome />,
      title: "Date Finder",
      description: "Find available game dates on your schedule using natural language.",
    },
    {
      icon: <Send />,
      title: "Bulk Emails",
      description: "Quickly email your game schedules using our advanced campaign manager and email tracking.",
    },
    {
      icon: <DepartureBoard />,
      title: "Travel Time",
      description: "Time, location, opponent, status, and travel info—all in one place.",
    },
    {
      icon: <People />,
      title: "Family Sharing",
      description: "Share access with caregivers, grandparents, or anyone coordinating around games.",
    },
    {
      icon: <CheckCircle />,
      title: "Always Accurate",
      description: "Know you always have the latest, most accurate schedule—no second-guessing.",
    },
  ];

  return (
    <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: theme.palette.background.default }}>
      <Container maxWidth="lg">
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography
              variant="overline"
              sx={{
                color: theme.palette.primary.main,
                fontWeight: 700,
                fontSize: "0.875rem",
                letterSpacing: "0.1em",
              }}
            >
              THE SOLUTION
            </Typography>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 900,
                fontSize: { xs: "2rem", md: "3rem" },
                mt: 2,
                mb: 3,
                color: theme.palette.text.primary,
              }}
            >
              One Central Hub to Manage Games.
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: theme.palette.text.secondary,
                mb: 4,
                lineHeight: 1.8,
                fontSize: "1.125rem",
              }}
            >
              Opletics gives you a centralized hub where you can upload, create and manage your athletic schedules all in one place. No more back-and-forth between emailing schedules, finding game
              dates or figuring out the right time for bus departure.
            </Typography>

            <Box sx={{ mb: 4 }}>
              {features.slice(0, 4).map((feature, index) => (
                <Box
                  key={index}
                  sx={{
                    display: "flex",
                    gap: 2,
                    py: 2,
                    borderBottom: index < 3 ? `1px solid ${theme.palette.divider}` : "none",
                  }}
                >
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      backgroundColor: "#171b38",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "25px solid #171b38",
                      flexShrink: 0,
                    }}
                  >
                    {feature.icon}
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, color: theme.palette.text.primary, mb: 0.5 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                      {feature.description}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>

            <Button
              variant="contained"
              size="large"
              sx={{
                backgroundColor: theme.palette.primary.main,
                color: "white",
                fontWeight: 700,
                px: 4,
                py: 1.5,
                borderRadius: 3,
                "&:hover": {
                  backgroundColor: theme.palette.primary.dark,
                },
              }}
            >
              See How It Works
            </Button>
          </Grid>

          <Grid item xs={12} md={6}>
            <Box
              sx={{
                height: { xs: 400, md: 500 },
                borderRadius: 4,
                background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                backgroundImage: "url(assets/images/calendar-ai-infographic.png)",
                backgroundRepeat: "no-repeat",
                backgroundSize: "100%",
                backgroundPosition: "center",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* <Box
                sx={{
                  textAlign: "center",
                  color: "white",
                  p: 4,
                }}
              >
                <CalendarMonth sx={{ fontSize: "8rem", opacity: 0.3, mb: 2 }} />
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  Your Schedule Hub
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Access all game information in one centralized location
                </Typography>
              </Box> */}
            </Box>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default SolutionSection;
