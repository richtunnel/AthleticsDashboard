import React from "react";
import { Box, Container, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";

export const Parallax: React.FC = () => {
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
              fontSize: { xs: "1.75rem", sm: "2.5rem", md: "3rem" },
              lineHeight: 1.2,
            }}
          >
            Spend more time on the move than at a desk.
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: "white",
              fontSize: { xs: "1rem", sm: "1.125rem", md: "1.25rem" },
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
