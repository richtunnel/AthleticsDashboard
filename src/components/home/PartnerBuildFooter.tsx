"use client";

import React, { useState } from "react";
import { Box, Container, Typography, Grid, Card, CardContent, Button, useTheme } from "@mui/material";
import { ArrowForward } from "@mui/icons-material";
import styles from "../../styles/footer.module.css";
import PartnerFormModal from "./PartnerFormModal";
import WaitlistFormModal from "./WaitlistFormModal";

const PartnerBuildSectionFooter = () => {
  const theme = useTheme();
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [waitlistModalOpen, setWaitlistModalOpen] = useState(false);

  const handlePartnerModalOpen = () => setPartnerModalOpen(true);
  const handlePartnerModalClose = () => setPartnerModalOpen(false);
  const handleWaitlistModalOpen = () => setWaitlistModalOpen(true);
  const handleWaitlistModalClose = () => setWaitlistModalOpen(false);

  return (
    <>
      <Box
        sx={{
          paddingTop: "80px",
          paddingBottom: "0px",
          backgroundColor: "transparent",
        }}
      >
        <Container className={styles.footerContainer} maxWidth="lg" style={{ margin: "0", padding: "0" }}>
          {/* Title */}
          <Typography
            className={styles.partnerFooterTitle}
            variant="h3"
            sx={{
              fontWeight: 700,
              fontSize: { xs: "2rem", md: "2.5rem" },
              lineHeight: 1.1,
              color: "#fff",
              textAlign: "left",
              maxWidth: 800,
              marginBottom: "12px",
            }}
          >
            Save Time Scheduling Games
          </Typography>

          {/* Cards Grid */}
          <Grid container spacing={3} sx={{ maxWidth: 900, padding: "0" }}>
            {/* Partner Card */}
            <Grid size={{ xs: 12, md: 6 }} sx={{ margin: "0", paddding: "0" }}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  borderRadius: 4,
                  p: 4,
                  backgroundColor: theme.palette.mode === "dark" ? theme.palette.grey[900] : theme.palette.grey[100],
                  border: `1px solid ${theme.palette.divider}`,
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: theme.shadows[8],
                  },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 300,
                }}
              >
                <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      mb: 3,
                      fontSize: { xs: "1.25rem", md: "1.5rem" },
                      color: theme.palette.text.primary,
                    }}
                  >
                    Partner with Opletics
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      color: theme.palette.text.secondary,
                      lineHeight: 1.6,
                      fontSize: "1.1rem",
                      mb: 4,
                    }}
                  >
                    Join the Opletics network to unlock access to our comprehensive ecosystem of athletic management tools and integrations.
                  </Typography>
                </CardContent>

                <Button
                  className={styles.PartnerFooterLinks}
                  variant="text"
                  endIcon={<ArrowForward />}
                  onClick={handlePartnerModalOpen}
                  sx={{
                    alignSelf: "flex-start",
                    fontWeight: 600,
                    fontSize: "1rem",
                    color: theme.palette.text.primary,
                    p: 0,
                    "&:hover": {
                      backgroundColor: "transparent",
                      "& .MuiSvgIcon-root": {
                        transform: "translateX(4px)",
                      },
                    },
                    "& .MuiSvgIcon-root": {
                      transition: "transform 0.2s ease",
                    },
                  }}
                >
                  Partner with us
                </Button>
              </Card>
            </Grid>

            {/* Build Card */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  borderRadius: 4,
                  p: 4,
                  backgroundColor: theme.palette.mode === "dark" ? "#1a1a2e" : "#2c2c54",
                  color: "white",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: theme.shadows[12],
                  },
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  minHeight: 300,
                }}
              >
                <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      mb: 3,
                      fontSize: { xs: "1.25rem", md: "1.5rem" },
                      color: "white",
                    }}
                  >
                    Parent Portal
                  </Typography>

                  <Typography
                    variant="body1"
                    sx={{
                      color: "rgba(255, 255, 255, 0.8)",
                      lineHeight: 1.6,
                      fontSize: "1.1rem",
                      mb: 4,
                    }}
                  >
                    Opletics Parent Portal gives you a centralized hub where you can access your child&apos;s complete athletic schedule—anytime, anywhere, on any device.{" "}
                  </Typography>
                </CardContent>

                <Button
                  className={styles.PartnerFooterLinks}
                  variant="text"
                  endIcon={<ArrowForward />}
                  onClick={handleWaitlistModalOpen}
                  sx={{
                    alignSelf: "flex-start",
                    fontWeight: 600,
                    fontSize: "1rem",
                    color: "white",
                    p: 0,
                    "&:hover": {
                      backgroundColor: "transparent",
                      "& .MuiSvgIcon-root": {
                        transform: "translateX(4px)",
                      },
                    },
                    "& .MuiSvgIcon-root": {
                      transition: "transform 0.2s ease",
                    },
                  }}
                >
                  Join Waitlist
                </Button>
              </Card>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Partner Form Modal */}
      <PartnerFormModal open={partnerModalOpen} onClose={handlePartnerModalClose} />

      {/* Waitlist Form Modal */}
      <WaitlistFormModal open={waitlistModalOpen} onClose={handleWaitlistModalClose} />
    </>
  );
};

export default PartnerBuildSectionFooter;
