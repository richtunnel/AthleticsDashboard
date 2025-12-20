"use client";

import { Box, Container, Stack, Typography, IconButton, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { ButtonLink } from "../../components/splash/button-link";
import { useEffect, useState, useRef } from "react";
import styles from "../../styles/logo.module.css";

export const ArcCard: React.FC = () => {
  const theme = useTheme();
  const [parallaxOffset, setParallaxOffset] = useState(0);
  const parallaxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!parallaxRef.current) return;

      const rect = parallaxRef.current.getBoundingClientRect();
      const scrollPercent = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);

      // Only apply parallax when element is in viewport
      if (scrollPercent >= 0 && scrollPercent <= 1) {
        // Negative value makes background move slower than scroll (parallax effect)
        setParallaxOffset(scrollPercent * -150);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial calculation
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <Container maxWidth="xl" sx={{ py: { xs: 4, md: 6 } }}>
        <Box
          sx={{
            bgcolor: "transparent",
            borderRadius: 4,
            p: { xs: 3, md: 5 },
            boxShadow: "none",
          }}
        >
          <Stack direction={{ xs: "column", lg: "row" }} spacing={{ xs: 3, lg: 5 }} alignItems="center">
            {/* left image */}
            <Box
              sx={{
                flex: "0 0 42%",
                maxWidth: { xs: "100%", lg: "42%" },
                minHeight: "420px",
                borderRadius: "20px",
                overflow: "hidden",
                bgcolor: "transparent",
                objectFit: "contain",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 0,
              }}
            >
              <Image src="/assets/images/fm-basketball-vertical.png" alt="Arc logo" width={625} height={685} style={{ objectFit: "contain", width: "auto", height: "685px", borderRadius: "20px" }} />
            </Box>

            {/* right content */}
            <Stack spacing={2} sx={{ flex: 1 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Chip label="Opletics Spreadsheets" color="secondary" variant="outlined" sx={{ px: 1.5, py: 0.5 }} />
              </Stack>

              <Typography className={`${styles.newSectionTitle}`} variant="h4" component="h3" sx={{ lineHeight: 1.2 }}>
                Schedule games without the endless back-and-forth
              </Typography>

              <Typography color="text.secondary" variant="h6" sx={{ maxWidth: "520px" }}>
                Reduce the endless back-and-forth with spreadsheets, emails or athletic departments and cut your scheduling time in half. Sync your spreadsheets with your calendars, send out multiple
                mass emails and stay organized with our other features.
              </Typography>
              <Stack direction="row" spacing={2} sx={{ pt: 1 }}>
                <ButtonLink size="medium" href="/onboarding/plans" variant="outlined" endIcon={<FiArrowRight />}>
                  Get Started
                </ButtonLink>
              </Stack>

              <Stack direction="row" justifyContent="space-between" sx={{ pt: 2 }}>
                {/* progress dots */}
                <Stack direction="row" spacing={1}>
                  <Box sx={{ width: "40px", height: "8px", borderRadius: "50px", bgcolor: "primary.main" }} />
                  <Box sx={{ width: "28px", height: "8px", borderRadius: "50px", bgcolor: "grey.300" }} />
                  <Box sx={{ width: "28px", height: "8px", borderRadius: "50px", bgcolor: "grey.300" }} />
                  <Box sx={{ width: "28px", height: "8px", borderRadius: "50px", bgcolor: "grey.300" }} />
                </Stack>
              </Stack>
            </Stack>
          </Stack>
        </Box>
      </Container>

      {/* Parallax Section */}
      <Box
        ref={parallaxRef}
        sx={{
          position: "relative",
          height: { xs: "100vh", lg: "100vh" },
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Parallax Background Image */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "130%",
            willChange: "transform",
            transform: `translate3d(0, ${parallaxOffset}px, 0)`,
          }}
        >
          <Image src="/assets/images/bball-court01.jpg" alt="Basketball Court" fill style={{ objectFit: "cover" }} priority />
        </Box>

        {/* Overlay */}
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            bgcolor: "rgba(0, 0, 0, 0.50)",
            zIndex: 1,
          }}
        />

        {/* Centered Text Content */}
        <Container
          maxWidth="md"
          sx={{
            position: "relative",
            zIndex: 2,
            textAlign: "center",
            px: { xs: 3, md: 4 },
          }}
        >
          <Typography
            variant="h3"
            component="h2"
            sx={{
              color: "white",
              fontWeight: 700,
              mb: 3,
              fontSize: { xs: "1.5rem", sm: "2.5rem", md: "3rem" },
              lineHeight: 1.2,
            }}
          >
            Spend more time on the move than at a desk.
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: "white",
              fontSize: { xs: "0.875rem", sm: "1.125rem", md: "1.25rem" },
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Free up space in your schedule by passing us the rock. Find dates using natural language, sync your calendar and automate processes.
          </Typography>
        </Container>
      </Box>
    </>
  );
};
