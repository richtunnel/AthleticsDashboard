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

const CALENDLY_URL = process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/athleticdirectorhub/30min";

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
      await getStartedAuth.executeAction({
        type: "navigation",
        navigationPath: "/onboarding/plans",
      });
    } catch (error) {
      console.error("Navigation error:", error);
    }
  };

  return (
    <div className="grid h-screen lg:grid-cols-[1fr_1.2fr] grid-cols-1 text-left">
      <div className="relative h-full lg:block hidden">
        <Image src="/assets/images/green-energy.jpg" alt="Athletics Dashboard Illustration" fill className="object-cover" priority />
      </div>

      <div className="flex flex-col h-full">
        <div className={styles.homeHeaderContainer}>
          <Link className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
            adhub
            <VscGithubProject />
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
            <h3 className="HomePageTitle text-5xl font-bold mb-4 leading-tight" style={{ color: "var(--text-primary)" }}>
              Athletic <br /> Directors Hub
            </h3>
            <p className="text-xl mb-8" style={{ maxWidth: "665px", padding: 0, color: "var(--text-secondary)" }}>
              Save time by doing what you never could with spreadsheets your personal spreadsheets.
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
                Sign in
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

        <Footer />
      </div>
    </div>
  );
}
