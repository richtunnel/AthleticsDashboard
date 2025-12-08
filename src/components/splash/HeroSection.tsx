import { Box, ButtonGroup, Chip, Container, IconButton, Stack, Typography } from "@mui/material";
import { Link } from "@mui/material";
import { FiArrowRight, FiBox, FiCheck, FiCode, FiCopy, FiFlag, FiGrid, FiLock, FiSearch, FiSliders, FiSmile, FiTerminal, FiThumbsUp, FiToggleLeft, FiTrendingUp, FiUserPlus } from "react-icons/fi";
import { BackgroundGradient } from "../../components/gradients/background-gradient";
import { FallInPlace } from "../../components/splash/fall-in-place";
import { ButtonLink } from "../../components/splash/button-link";

import { Hero } from "../../components/splash/hero";
import Image from "next/image";

export const HeroSection: React.FC = () => {
  return (
    <Box sx={{ position: "relative", overflow: "hidden" }}>
      <BackgroundGradient height="100%" zIndex="-1" />
      <Container maxWidth="xl" sx={{ pt: { xs: 10, lg: 20 }, pb: 20 }}>
        <Stack direction={{ xs: "column", lg: "row" }} alignItems="center">
          <Hero
            id="home"
            justifyContent="flex-start"
            px="0"
            title={<FallInPlace>Automate Your Entire Game Scheduling Workflow</FallInPlace>}
            description={
              <FallInPlace delay={0.4} fontWeight="medium">
                A platform that helps athletic directors, coaches, and staff streamline their day-to-day game-scheduling workflow.{" "}
              </FallInPlace>
            }
          >
            <br />
            <FallInPlace delay={0.8}>
              {/* <Stack direction="row" spacing={2} sx={{ pt: 2, pb: 6 }}>
                <NextjsLogo height="28px" /> <ChakraLogo height="20px" />
              </Stack> */}

              <ButtonGroup sx={{ spacing: 2, alignItems: "center" }}>
                <ButtonLink color="primary" size="large" href="/signup">
                  Sign Up
                </ButtonLink>
                <ButtonLink
                  size="large"
                  href="#"
                  variant="outlined"
                  startIcon={
                    <FiArrowRight
                      style={{
                        transition: "transform 0.2s",
                      }}
                    />
                  }
                >
                  Book a demo
                </ButtonLink>
              </ButtonGroup>
            </FallInPlace>
          </Hero>
          <Box
            sx={{
              height: "600px",
              position: "absolute",
              display: { xs: "none", lg: "block" },
              left: { lg: "60%", xl: "55%" },
              width: "80vw",
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
                <Image src="/assets/images/gtable.png" width={1400} height={762} alt="Opletics Dashboard" quality="75" priority />
              </Box>
            </FallInPlace>
          </Box>
        </Stack>
      </Container>

      {/* <Features
        id="benefits"
        columns={[1, 2, 4]}
        iconSize={4}
        innerWidth="container.xl"
        pt="20"
        features={[
          // ... features array
        ]}
        reveal={FallInPlace}
      /> */}
    </Box>
  );
};
