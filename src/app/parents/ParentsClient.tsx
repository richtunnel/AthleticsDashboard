"use client";

import React, { useState } from "react";
import { Box, Container, Typography, GridLegacy as Grid, Card, Button, useTheme } from "@mui/material";
import { CheckCircle, Notifications, Sync, CalendarMonth, People } from "@mui/icons-material";
import BaseHeaderWhite from "@/components/headers/_baseWhite";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import RadarIcon from "@mui/icons-material/Radar";
import AlarmIcon from "@mui/icons-material/Alarm";
import WaitlistFormModal from "@/components/home/WaitlistFormModal";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const ParentsClient = () => {
  const theme = useTheme();
  const router = useRouter();
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const handleWaitlistModal = () => setWaitlistModalOpen((prev) => !prev);

  const handleGetStarted = () => {
    router.push("/onboarding/parent-signup");
  };

  const problems = [
    {
      icon: <MarkEmailUnreadIcon sx={{ color: "#fff" }} />,
      title: "Lost in the Inbox",
      description:
        "That email with the game schedule? It's buried under 47 other messages. Or worse—it was sent to the inbox you never check.",
    },
    {
      icon: <EventBusyIcon style={{ color: "#fff" }} />,
      title: "Outdated Information",
      description:
        "The schedule changed last Tuesday, but nobody told you. You show up at the old time, only to find an empty field.",
    },
    {
      icon: <RadarIcon style={{ color: "#fff" }} />,
      title: "Playing Detective",
      description:
        "Is it 3 PM or 3:30 PM? Home or away? Which field? You're texting other parents, checking old emails, trying to piece together the truth.",
    },
    {
      icon: <AlarmIcon style={{ color: "#fff" }} />,
      title: "Last-Minute Surprises",
      description:
        "It's Friday at 5 PM and you just learned about tomorrow's 8 AM game. Scramble to rearrange schedules and hope for the best.",
    },
  ];

  const features = [
    {
      icon: <Sync />,
      title: "Real-Time Updates",
      description: "Schedule changes sync instantly to your portal—no delays, no confusion.",
    },
    {
      icon: <CalendarMonth />,
      title: "Calendar Integration",
      description: "Sync games directly to your personal calendar with one click.",
    },
    {
      icon: <Notifications />,
      title: "Smart Notifications",
      description: "Get alerts for schedule changes, game reminders, and important updates.",
    },
    {
      icon: <People />,
      title: "Family Sharing",
      description: "Share access with caregivers, grandparents, or anyone coordinating around games.",
    },
  ];

  return (
    <>
      <BaseHeaderWhite
        pt="20px"
        pl="20px"
        sx={{
          position: "absolute!important",
          zIndex: "9",
        }}
      />
      <Box sx={{ backgroundColor: theme.palette.background.default }}>
        <Box
          sx={{
            backgroundColor: "#003153",
            backgroundImage: "linear-gradient(315deg, #003153 0%, #1B1B1B 74%)",
            color: "white",
            py: { xs: 8, md: 12 },
            position: "relative",
            overflow: "hidden",
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ position: "relative", zIndex: 1 }}>
              <Typography
                variant="h1"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "2.5rem", md: "4rem", lg: "4.5rem" },
                  lineHeight: 1.1,
                  mb: 3,
                  letterSpacing: "-0.02em",
                }}
              >
                Parents <span style={{ color: "#ceff77" }}>Sport Connect</span>
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  maxWidth: 700,
                  mb: 5,
                  opacity: 0.95,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  fontSize: { xs: "1.125rem", md: "1.375rem" },
                }}
              >
                Sync your child’s game schedule with your personal calendar. The ultimate athlete management system for parents and families.
              </Typography>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
                  onClick={handleGetStarted}
                  variant="contained"
                  size="large"
                  sx={{
                    backgroundColor: "#ceff77",
                    color: "#000",
                    fontWeight: 700,
                    px: 4,
                    py: 1.5,
                    fontSize: "1.125rem",
                    borderRadius: 3,
                    "&:hover": {
                      backgroundColor: "#d4ff88",
                      transform: "translateY(-2px)",
                    },
                    transition: "all 0.3s ease",
                  }}
                >
                  Get Started&nbsp; <NavigateNextIcon />
                </Button>
                <Button
                  onClick={() => signIn("google", { callbackUrl: "/parent-dashboard" })}
                  variant="outlined"
                  size="large"
                  sx={{
                    borderColor: "rgba(255, 255, 255, 0.3)",
                    color: "white",
                    fontWeight: 700,
                    px: 4,
                    py: 1.5,
                    fontSize: "1.125rem",
                    borderRadius: 3,
                    "&:hover": {
                      borderColor: "rgba(255, 255, 255, 0.6)",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                    },
                  }}
                >
                  Sign in
                </Button>
              </Box>

              <Grid container spacing={4} sx={{ mt: 6 }}>
                {[
                  { value: "500+", label: "Parents enrolled" },
                  { value: "99.9%", label: "Calendar Accuracy" },
                  { value: "Real-Time", label: "Instant Game Updates" },
                ].map((stat, index) => (
                  <Grid item xs={12} sm={4} key={index}>
                    <Box
                      sx={{
                        p: 3,
                        backgroundColor: "transparent;",
                        backdropFilter: "blur(10px)",
                        borderRadius: 3,
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <Typography
                        variant="h3"
                        sx={{
                          fontWeight: 900,
                          color: "#ceff77",
                          mb: 0.5,
                        }}
                      >
                        {stat.value}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: "rgba(255, 255, 255, 0.8)",
                          fontWeight: 500,
                        }}
                      >
                        {stat.label}
                      </Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </Container>
        </Box>

        <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: theme.palette.background.paper }}>
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: 8 }}>
              <Typography
                variant="overline"
                sx={{
                  color: theme.palette.primary.main,
                  fontWeight: 700,
                  fontSize: "0.875rem",
                  letterSpacing: "0.1em",
                }}
              >
                THE PROBLEM
              </Typography>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "2rem", md: "3rem" },
                  mt: 2,
                  mb: 2,
                  color: theme.palette.text.primary,
                }}
              >
                Schedule Chaos Parents Face Every Season
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {problems.map((problem, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      height: "100%",
                      p: 4,
                      border: `2px solid ${theme.palette.divider}`,
                      borderRadius: 4,
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-8px)",
                        borderColor: theme.palette.primary.main,
                        boxShadow: theme.shadows[8],
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 50,
                        height: 50,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, #313f72)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2rem",
                        mb: 3,
                      }}
                    >
                      {problem.icon}
                    </Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 2, color: theme.palette.text.primary }}>
                      {problem.title}
                    </Typography>
                    <Typography variant="body1" sx={{ color: theme.palette.text.secondary, lineHeight: 1.7 }}>
                      {problem.description}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

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
                  One Portal. All Games. Always Current.
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
                  Opletics Parent Portal gives you a centralized hub where you can access your child's complete athletic schedule—anytime, anywhere, on any device.
                </Typography>

                <Box sx={{ mb: 4 }}>
                  {features.map((feature, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: "flex",
                        gap: 2,
                        py: 2,
                        borderBottom: index < features.length - 1 ? `1px solid ${theme.palette.divider}` : "none",
                      }}
                    >
                      <Box
                        sx={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          backgroundColor: "#d5ff88",
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
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
                  onClick={handleGetStarted}
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
                  Get Started Now
                </Button>
              </Grid>

              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    height: { xs: 400, md: 500 },
                    borderRadius: 4,
                    background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      textAlign: "center",
                      color: "white",
                      p: 4,
                    }}
                  >
                    <CalendarMonth sx={{ fontSize: "8rem", opacity: 0.3, mb: 2 }} />
                    <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                      Your Schedule Hub
                    </Typography>
                    <Typography variant="body1" sx={{ opacity: 0.9 }}>
                      Access all game information in one centralized location
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Container>
        </Box>
      </Box>

      <WaitlistFormModal open={waitlistModalOpen} onClose={handleWaitlistModal} />
    </>
  );
};

export default ParentsClient;
