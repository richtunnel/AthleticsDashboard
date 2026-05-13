import { Box, Container, IconButton, Stack, Typography } from "@mui/material";
import { Link } from "@mui/material";
import { FiArrowRight } from "react-icons/fi";
import { BackgroundGradient } from "../../components/gradients/background-gradient";
import { FallInPlace } from "../../components/splash/fall-in-place";
import { ButtonLink } from "../../components/splash/button-link";
import { Hero } from "../../components/splash/hero";
import Image from "next/image";
import styles from "@/styles/hero.module.css";

export const HeroSection: React.FC = () => {
  return (
    <Box sx={{ position: "relative", overflow: "hidden", padding: "0", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
      {/* <BackgroundGradient height="100%" zIndex="-1" /> */}
      <Container maxWidth="xl" sx={{ pt: { xs: 2, lg: 20 }, pb: { xs: 4, lg: 20 } }}>
        <Stack direction={{ xs: "column", lg: "row" }} alignItems="center">
          <Hero
            id="home"
            justifyContent="flex-start"
            px="0"
            title={
              <FallInPlace>
                <Typography
                  variant="h2"
                  component="h1"
                  sx={{
                    fontSize: { xs: "2.5rem", sm: "2.5rem", md: "3rem", lg: "3.5rem" },
                    lineHeight: 1.2,
                    fontWeight: 700,
                    maxWidth: "600px",
                  }}
                >
                  Schedule Games in Half the Time.
                </Typography>
              </FallInPlace>
            }
            description={
              <FallInPlace delay={0.4}>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: { xs: "1rem", md: "1.125rem" },
                    fontWeight: 400,
                    color: "text.secondary",
                    maxWidth: "600px",
                  }}
                >
                  Our dashboard helps athletic directors, coaches, and staff streamline their day-to-day game-scheduling workflow. Sync your game schedules with your calendars and groups, create mass
                  email campaigns, easily find game dates, track scores, and more.
                </Typography>
              </FallInPlace>
            }
          >
            <br />
            <FallInPlace delay={0.8}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <ButtonLink variant="contained" size="large" href="/signup">
                  Sign Up
                </ButtonLink>
                <ButtonLink
                  size="large"
                  href="#"
                  variant="outlined"
                  endIcon={<FiArrowRight />}
                  sx={{
                    "& .MuiButton-endIcon": {
                      transition: "transform 0.2s",
                    },
                    "&:hover .MuiButton-endIcon": {
                      transform: "translateX(4px)",
                    },
                  }}
                >
                  Book a demo
                </ButtonLink>
              </Stack>
            </FallInPlace>
          </Hero>
          <Box
            sx={{
              height: { xs: "320px", md: "420px", lg: "600px" },
              position: { xs: "relative", md: "absolute" },
              display: { xs: "block", lg: "block" },
              left: { xs: "0", lg: "60%", xl: "55%" },
              width: { xs: "100vw", md: "80vw" },
              maxWidth: "1100px",
              margin: "0 auto",
              borderRadius: "20px",
            }}
          >
            <FallInPlace delay={1}>
              <Box
                sx={{
                  overflow: "hidden",
                  height: "100%",
                  borderRadius: "20px",
                }}
              >
                <Image src="/assets/images/gtable3.png" width={1400} height={762} alt="Opletics Dashboard" quality="75" priority />
              </Box>
            </FallInPlace>
          </Box>
          {/* <Box
            className={styles.laptopImageContainer}
            sx={{
              position: "relative",
              display: { md: "none", lg: "none" },
              width: "80vw",
              maxWidth: "1100px",
              margin: "0 auto",
            }}
          >
            <FallInPlace delay={1}>
              <Box
                sx={{
                  overflow: "hidden",
                  height: "100%",
                  borderRadius: "20px",
                }}
              >
                <Image src="/assets/images/gtable3.png" width={1400} height={762} alt="Opletics Dashboard" quality="75" priority />
              </Box>
            </FallInPlace>
          </Box> */}
        </Stack>
      </Container>
    </Box>
  );
};
