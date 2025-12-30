"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "../../styles/logo.module.css";
import { VscGithubProject } from "react-icons/vsc";
import { useAuthButton } from "@/lib/hooks/useAuthButton";
import { AuthActionButton } from "@/components/auth/AuthActionButton";
import { useSession } from "next-auth/react";
import Footer from "@/components/layout/Footer";
import BookDemoButton from "@/components/buttons/BookDemoButton";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import FingerprintIcon from "@mui/icons-material/Fingerprint";
import { HeroSection } from "../splash/HeroSection";
import { ArcCard } from "../splash/SectionCard";
import { Faq } from "../splash/faq";
import faqsData from "@/data/faq";
import { FeaturesSection } from "../splash/FeatureSection";
import { Card } from "@mui/material";
import { Footer as SplashFooter } from "../splash/footer";
import { CircularProjectIcon } from "../circle-logo/OpleticsLogo";
import DreamSection from "./dreamSection";
import PartnerBuildSection from "./PartnerBuildSection";
import NewsSection from "./NewsSection";
import PartnerBuildSectionFooter from "./PartnerBuildFooter";
import { FaInstagram, FaFacebook } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import SolutionSection from "../sections/SolutionSection";
import TopFooter from "../footer/topFooter";

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/opletics/30min";

export default function HomePageContent() {
  const { data: session, status } = useSession();
  const signInAuth = useAuthButton();
  const getStartedAuth = useAuthButton();

  const handleSignIn = async () => {
    try {
      if (status === "authenticated" && session) {
        await signInAuth.executeAction({
          type: "navigation",
          navigationPath: "/dashboard",
        });
      } else {
        await signInAuth.executeAction({
          type: "navigation",
          navigationPath: "/login",
        });
      }
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  const handleGetStarted = async () => {
    try {
      trackEvent("Get Started Clicked", {
        source: "homepage",
        button_location: "hero",
      });
      await getStartedAuth.executeAction({
        type: "navigation",
        navigationPath: "/onboarding/plans",
      });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  return (
    <>
      <div
        className="grid h-screen lg:grid-cols-[1fr_1.2fr] grid-cols-1 text-left"
        style={{
          backgroundColor: "#fdfdfd",
          color: "#0f172a",
        }}
      >
        {/* Desktop image - hidden on mobile */}
        <div className="relative h-full lg:block hidden">
          <Image src="/assets/images/green-energy.jpg" alt="Opletics athletic department scheduling software" fill className="object-cover" priority />
        </div>

        {/* Desktop content */}
        <div className="lg:flex hidden flex-col h-full">
          <div
            className={styles.homeHeaderContainer}
            style={{
              color: "#0f172a",
            }}
          >
            <Link
              className={`${styles["ad-hub-logo"]} flex d-flex`}
              href="/"
              style={{
                color: "#0f172a",
              }}
            >
              <CircularProjectIcon />
              <span className={styles.opleticsLogoText} style={{ marginLeft: "2.5px", letterSpacing: "-0.35px" }}>
                opletics
              </span>
            </Link>

            <BookDemoButton
              calendlyUrl={CALENDLY_URL}
              sx={{
                px: 3,
                py: 1,
                fontSize: "0.95rem",
              }}
            />
          </div>

          <div className="flex flex-1 items-center justify-center px-4">
            <div className={styles.homePageContentContainer}>
              <h3
                className="HomePageTitle text-5xl font-bold mb-4 leading-tight"
                style={{
                  color: "#0f172a",
                }}
              >
                Automate Your <br /> Sports Schedules
              </h3>
              <p
                className="text-xl mb-8"
                style={{
                  maxWidth: "665px",
                  padding: 0,
                  color: "rgb(97 98 99)",
                  fontWeight: "500",
                }}
              >
                Upload your sports schedule spreadsheet as a CSV and start automating your daily workflow.
              </p>
              <div className="flex flex-col sm:flex-row content-center items-center gap-4">
                <AuthActionButton
                  onClick={handleSignIn}
                  loading={signInAuth.loading}
                  classname={styles.signInButton}
                  disabled={getStartedAuth.loading}
                  variant="contained"
                  sx={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-contrast)",
                    fontWeight: 600,
                    boxShadow: "var(--shadow-soft)",
                    borderRadius: "0.75rem",
                    px: 4,
                    py: 1.5,
                    fontSize: "1.05rem",
                    transition: "transform 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      backgroundColor: "var(--accent)",
                    },
                  }}
                >
                  Sign in&nbsp;
                  <FingerprintIcon sx={{ color: "rgb(92 142 4)" }} />
                </AuthActionButton>
                <AuthActionButton
                  onClick={handleGetStarted}
                  loading={getStartedAuth.loading}
                  disabled={signInAuth.loading}
                  variant="text"
                  sx={{
                    fontSize: "1.05rem",
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--accent-contrast)",
                    fontWeight: 600,
                    textDecoration: "underline",
                    "&:hover": {
                      background: "transparent",
                    },
                  }}
                >
                  Get Started
                </AuthActionButton>
              </div>
            </div>
          </div>

          <TopFooter />
        </div>

        {/* Mobile: Full height container like Buyable */}
        <div className={`${styles.mobileHeroContainer} lg:hidden relative flex flex-col h-screen`} style={{ backgroundColor: "#fdfdfd" }}>
          {/* Header - dark background blending into gradient with white text */}
          <div className="px-4 py-3 flex justify-between items-center relative z-30" style={{ backgroundColor: "rgb(17 17 17)" }}>
            <Link
              className={`${styles["ad-hub-logo"]} flex`}
              href="/"
              style={{
                color: "white",
                fontSize: "1.85rem",
              }}
            >
              <CircularProjectIcon />
              <span style={{ marginLeft: "2.5px", letterSpacing: "-0.35px" }}>opletics</span>
            </Link>
            <BookDemoButton
              calendlyUrl={CALENDLY_URL}
              sx={{
                px: 2.5,
                py: 0.8,
                fontSize: "0.9rem",
                color: "#000",
                borderColor: "#000",
                backgroundColor: "#ceff77",
              }}
            />
          </div>

          {/* Full height hero container - 90% like Buyable */}
          <div className={`relative flex-1 ${styles.fullHeightMobileHero}`}>
            {/* Content overlay */}
            <div className="absolute inset-0 px-4 flex flex-col justify-between z-20">
              <div className={styles.mobileSpreadsheetContainer}>
                <Image className={styles.mobileSpreadsheetImg} fill src="/assets/images/spreadsheet-illustration-dark-01.png" alt="spreadsheet illustration" style={{ objectFit: "contain" }} />
              </div>
              {/* Top content */}
              <div className={`pt-2 ${styles["mobile-hero-section"]}`}>
                <h4 className={`${styles.heroTitle} font-bold leading-tight mb-6`} style={{ color: "white" }}>
                  Automate Your Sports Schedules
                </h4>
                <p className="max-w-sm leading-relaxed" style={{ color: "#e5e7eb", fontSize: "0.985", padding: "12px 0px" }}>
                  Upload your sports schedule spreadsheet as a CSV and start automating your daily workflow.
                </p>
              </div>

              {/* Bottom content */}
              <div className="pb-12 space-y-4">
                <AuthActionButton
                  onClick={handleSignIn}
                  loading={signInAuth.loading}
                  disabled={getStartedAuth.loading}
                  classname={`${styles.signInButton}`}
                  variant="contained"
                  sx={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-contrast)",
                    fontWeight: 600,
                    boxShadow: "var(--shadow-soft)",
                    borderRadius: "0.75rem",
                    px: 4,
                    py: 1.5,
                    fontSize: "1.1rem",
                    width: "100%",
                    transition: "transform 0.2s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      backgroundColor: "var(--accent)",
                    },
                  }}
                >
                  Sign in&nbsp;
                  <FingerprintIcon sx={{ color: "rgb(92 142 4)" }} />
                </AuthActionButton>

                <div className="text-center">
                  <AuthActionButton
                    onClick={handleGetStarted}
                    classname={`${styles.tryNowButton}`}
                    loading={getStartedAuth.loading}
                    disabled={signInAuth.loading}
                    variant="text"
                    sx={{
                      fontSize: "1.1rem",
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      color: "white",
                      fontWeight: 600,
                      textDecoration: "underline",
                      "&:hover": {
                        background: "transparent",
                      },
                    }}
                  >
                    Try Now
                  </AuthActionButton>
                </div>

                {/* Social Icons Only */}
                <div className="flex justify-center gap-4 pt-4">
                  <a
                    href="https://www.instagram.com/opletics"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#e5e7eb",
                      fontSize: "1.35rem",
                      transition: "color 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#e5e7eb")}
                  >
                    <FaInstagram />
                  </a>
                  <a
                    href="https://facebook.com/opletics"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#e5e7eb",
                      fontSize: "1.35rem",
                      transition: "color 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#e5e7eb")}
                  >
                    <FaFacebook />
                  </a>
                  <a
                    href="https://x.com/opletics"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: "#e5e7eb",
                      fontSize: "1.35rem",
                      transition: "color 0.2s ease",
                      display: "flex",
                      alignItems: "center",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseOut={(e) => (e.currentTarget.style.color = "#e5e7eb")}
                  >
                    <FaXTwitter />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <ArcCard />
      <HeroSection />
      <SolutionSection />
      {/* <FeaturesSection /> */}
      <NewsSection />
      <br />
      <br />
      <br />
      {/* <Faq {...faqsData} /> */}
      <br /> <br />
      {/* <SoccerBeach /> */}
      <DreamSection />
      {/* <PartnerBuildSection /> */}
      <SplashFooter />
    </>
  );
}
