"use client";

import React, { useState } from "react";
import { Box, Container, Typography, GridLegacy as Grid, Card, CardContent, Button, Chip, useTheme } from "@mui/material";
import { ArrowForward, CheckCircle, Schedule, Notifications, Sync, CalendarMonth, People } from "@mui/icons-material";
import BaseHeaderWhite from "@/components/headers/_baseWhite";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import RadarIcon from "@mui/icons-material/Radar";
import AlarmIcon from "@mui/icons-material/Alarm";
import WaitlistFormModal from "@/components/home/WaitlistFormModal";

const ParentPortalPage = () => {
  const theme = useTheme();
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);
  const handleWaitlistModal = () => setWaitlistModalOpen((prev) => !prev);

  const problems = [
    {
      icon: <MarkEmailUnreadIcon />,
      title: "Lost in the Inbox",
      description:
        "That email with the game schedule? It's buried under 47 other messages. Or worse—it was sent to the inbox you never check. By the time you find it, you've already missed the first game.",
    },
    {
      icon: <EventBusyIcon />,
      title: "Outdated Information",
      description:
        "The schedule changed last Tuesday, but nobody told you. You show up at the old time, only to find an empty field and a very confused kid. The updated schedule? Still sitting in someone's draft folder.",
    },
    {
      icon: <RadarIcon />,
      title: "Playing Detective",
      description:
        "Is it 3 PM or 3:30 PM? Home or away? Which field? You're texting other parents, checking old emails, and scrolling through group chats trying to piece together the truth like you're solving a mystery.",
    },
    {
      icon: <AlarmIcon />,
      title: "Last-Minute Surprises",
      description:
        "It's Friday at 5 PM and you just learned about tomorrow's 8 AM game. Cancel your plans, scramble to rearrange schedules, and hope you packed the uniform last night. This is not how weekends should start.",
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
      icon: <Schedule />,
      title: "Complete Game Details",
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

  const benefits = [
    {
      icon: "⏱️",
      title: "Save Hours Every Week",
      description: "Stop hunting through emails and group texts. Get the schedule you need in seconds, not minutes.",
    },
    {
      icon: "✅",
      title: "Zero Missed Games",
      description: "With real-time updates and smart reminders, you'll never show up at the wrong time or place again.",
    },
    {
      icon: "😌",
      title: "Peace of Mind",
      description: "Know that you always have the latest, most accurate schedule—no second-guessing required.",
    },
    {
      icon: "👨‍👩‍👧",
      title: "Better Family Planning",
      description: "Share access with caregivers, grandparents, or anyone who needs to coordinate around games.",
    },
    {
      icon: "📲",
      title: "Works Everywhere",
      description: "Check schedules from any device—phone, tablet, or computer. Your portal goes where you go.",
    },
    {
      icon: "🎯",
      title: "Stay Organized",
      description: "Manage multiple athletes and sports in one place. No more juggling different systems or spreadsheets.",
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
        {/* Hero Section */}
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
              {/* <Chip
                label="Introducing Parent Portal"
                sx={{
                  mb: 3,
                  backgroundColor: "rgba(206, 255, 119, 0.15)",
                  color: "#ceff77",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  border: "1px solid rgba(206, 255, 119, 0.3)",
                }}
              /> */}
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
                Never Miss a <span style={{ color: "#ceff77" }}>Game Again</span>
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  maxWidth: 700,
                  mb: 5,
                  opacity: 0.95,
                  fontWeight: 400,
                  lineHeight: 1.6,
                  fontSize: { xs: "1.125rem", md: "1.375rem" },
                }}
              >
                Sync your child’s game schedule directly to your personal calendar. Discover how Channl helps you support your child’s fundraising efforts while staying connected to their school
                journey.{" "}
              </Typography>
              <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                <Button
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
                  Join the waitlist&nbsp; <NavigateNextIcon />
                </Button>
                {/* <Button
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
                  Watch Demo
                </Button> */}
              </Box>

              {/* Stats */}
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

        {/* Problem Section */}
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
                Schedule Chaos
                <br /> Parents Face Every Season
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.text.secondary,
                  maxWidth: 700,
                  mx: "auto",
                  fontWeight: 400,
                }}
              >
                If this sounds fimiliar you're not alone. Thousands of parents struggle with these exact same issues every single day.
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
                        width: 64,
                        height: 64,
                        borderRadius: 3,
                        background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
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

        {/* Solution Section */}
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
                  Opletics Parent Portal gives you a centralized hub where you can access your child's complete athletic schedule—anytime, anywhere, on any device. No hunting through emails. No
                  guessing. Just the information you need, exactly when you need it.
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
                          backgroundColor: "#d5ff88",
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "25px solid #d6ff88",
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
                    <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
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

        {/* Benefits Section */}
        {/* <Box
          sx={{
            py: { xs: 8, md: 12 },
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: "white",
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ textAlign: "center", mb: 8 }}>
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "2rem", md: "3rem" },
                  mb: 2,
                }}
              >
                Built for Busy Parents Who Refuse to Miss a Moment
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  opacity: 0.9,
                  maxWidth: 700,
                  mx: "auto",
                  fontWeight: 400,
                }}
              >
                Because being there for your athlete shouldn't require a detective's skills or a personal assistant's schedule.
              </Typography>
            </Box>

            <Grid container spacing={4}>
              {benefits.map((benefit, index) => (
                <Grid item xs={12} sm={6} md={4} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      height: "100%",
                      p: 4,
                      textAlign: "center",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                      borderRadius: 4,
                      transition: "all 0.3s ease",
                      "&:hover": {
                        transform: "translateY(-8px)",
                        backgroundColor: "rgba(255, 255, 255, 0.15)",
                        borderColor: "#ceff77",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: 3,
                        background: "linear-gradient(135deg, #ceff77, #b8e668)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "2.5rem",
                        mx: "auto",
                        mb: 3,
                      }}
                    >
                      {benefit.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "white" }}>
                      {benefit.title}
                    </Typography>
                    <Typography variant="body2" sx={{ color: "rgba(255, 255, 255, 0.8)", lineHeight: 1.7 }}>
                      {benefit.description}
                    </Typography>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box> */}

        {/* CTA Section */}
        <Box sx={{ py: { xs: 8, md: 12 }, backgroundColor: theme.palette.background.paper }}>
          <Container maxWidth="md">
            <Card
              elevation={0}
              sx={{
                p: { xs: 4, md: 8 },
                textAlign: "center",
                border: `2px solid ${theme.palette.divider}`,
                borderRadius: 4,
                position: "relative",
                overflow: "hidden",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 6,
                  background: `linear-gradient(90deg, ${theme.palette.primary.main}, #ceff77)`,
                },
              }}
            >
              <Typography
                variant="h2"
                sx={{
                  fontWeight: 900,
                  fontSize: { xs: "2rem", md: "3rem" },
                  mb: 2,
                  color: theme.palette.text.primary,
                }}
              >
                Ready to End the Schedule Chaos?
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  color: theme.palette.text.secondary,
                  mb: 4,
                  fontWeight: 400,
                }}
              >
                Join thousands of parents who've already taken control of their family's athletic calendar. Start your free trial today—no credit card required.
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "center", gap: 3, flexWrap: "wrap", mb: 4 }}>
                {["14-day free trial", "No credit card needed", "Cancel anytime"].map((feature, index) => (
                  <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CheckCircle sx={{ color: theme.palette.success.main, fontSize: "1.25rem" }} />
                    <Typography variant="body1" sx={{ fontWeight: 600, color: theme.palette.text.secondary }}>
                      {feature}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Button
                onClick={handleWaitlistModal}
                variant="contained"
                size="large"
                sx={{
                  backgroundColor: theme.palette.primary.main,
                  color: "white",
                  fontWeight: 700,
                  px: 5,
                  py: 2,
                  fontSize: "1.25rem",
                  borderRadius: 3,
                  "&:hover": {
                    backgroundColor: theme.palette.primary.dark,
                    transform: "translateY(-2px)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                Start Your Free Trial
              </Button>
            </Card>
          </Container>
        </Box>
      </Box>

      {/* Waitlist Form Modal */}
      <WaitlistFormModal open={waitlistModalOpen} onClose={handleWaitlistModal} />
    </>
  );
};

export default ParentPortalPage;
