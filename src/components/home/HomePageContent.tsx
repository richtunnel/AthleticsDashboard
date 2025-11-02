"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "../../styles/logo.module.css";
import { VscGithubProject } from "react-icons/vsc";
import { FaInstagram, FaFacebook } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useAuthButton } from "@/lib/hooks/useAuthButton";
import { AuthActionButton } from "@/components/auth/AuthActionButton";

export default function HomePageContent() {
  const signInAuth = useAuthButton();
  const getStartedAuth = useAuthButton();

  const handleSignIn = async () => {
    try {
      await signInAuth.executeAction({
        type: "navigation",
        navigationPath: "/login",
      });
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
    <div className="grid h-screen grid-cols-[1fr_1.2fr] text-left">
      <div className="relative h-full">
        <Image src="/assets/images/green-energy.jpg" alt="Athletics Dashboard Illustration" fill className="object-cover" priority />
      </div>

      <div className="flex flex-col h-full">
        <div className={styles.homeHeaderContainer}>
          <Link className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
            adhub
            <VscGithubProject />
          </Link>

          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                fontSize: "1.25rem",
                transition: "color 0.2s ease",
                display: "flex",
                alignItems: "center",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              <FaInstagram />
            </a>
            <a
              href="https://facebook.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                fontSize: "1.25rem",
                transition: "color 0.2s ease",
                display: "flex",
                alignItems: "center",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              <FaFacebook />
            </a>
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                fontSize: "1.25rem",
                transition: "color 0.2s ease",
                display: "flex",
                alignItems: "center",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              <FaXTwitter />
            </a>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className={styles.homePageContentContainer}>
            <h3 className="text-5xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
              Athletic <br /> Directors Hub
            </h3>
            <p className="text-xl mb-8" style={{ maxWidth: "665px", padding: 0, color: "var(--text-secondary)" }}>
              A smart spreadsheet allowing athletic directors to automate, process and manage athletic schedules with ease.
            </p>
            <div className="d-flex flex content-center items-center gap-4">
              <AuthActionButton
                onClick={handleSignIn}
                loading={signInAuth.loading}
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

        <footer
          style={{
            padding: "1.5rem 2rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <Link
              href="/about"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              About Us
            </Link>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Privacy
            </Link>
            <Link
              href="/dashboard/feedback"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Need Assistance
            </Link>
          </div>
          <div>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.75rem",
                fontWeight: 400,
              }}
            >
              &copy; {new Date().getFullYear()} Athletic Directors Hub. All rights reserved.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
