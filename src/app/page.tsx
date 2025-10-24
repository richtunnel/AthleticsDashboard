"use client";

import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import styles from "../styles/logo.module.css";
import { VscGithubProject } from "react-icons/vsc";
import SignUpPlan from "./onboarding/plans/page";

export default function HomePage() {
  const [showPricing, setShowPricing] = useState(false);

  const handleBackToHome = () => {
    setShowPricing(false);
  };

  const setShowPricingButton = (e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => {
    e.preventDefault();
    setShowPricing((prev) => !prev);
  };

  return (
    <div className="grid h-screen grid-cols-[1fr_1.2fr] text-left">
      <div className="relative h-full">
        <Image src="/assets/images/green-energy.jpg" alt="Athletics Dashboard Illustration" fill className="object-cover" priority />
      </div>

      <div>
        <div className={styles.homeHeaderContainer}>
          <Link className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
            adhub
            <VscGithubProject />
          </Link>

          <Link href="/" style={{ color: "var(--text-secondary)", fontWeight: 600 }}>
            Need Help?
          </Link>
        </div>

        <div className="flex h-full items-center justify-center">
          {showPricing ? (
            <SignUpPlan onBackClick={handleBackToHome} />
          ) : (
            <div className={styles.homePageContentContainer}>
              <h3 className="text-5xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
                Athletic <br /> Directors Hub
              </h3>
              <p className="text-xl mb-8" style={{ maxWidth: "665px", padding: 0, color: "var(--text-secondary)" }}>
                A smart spreadsheet allowing athletic directors to automate, process and manage athletic schedules with ease.
              </p>
              <div className="d-flex flex content-center items-center gap-4">
                <Link
                  href="/dashboard/games"
                  style={{
                    backgroundColor: "var(--accent)",
                    color: "var(--accent-contrast)",
                    fontWeight: 600,
                    boxShadow: "var(--shadow-soft)",
                    borderRadius: "0.75rem",
                  }}
                  className="inline-flex px-8 py-3 rounded-lg font-semibold transition-transform duration-200 hover:-translate-y-0.5"
                >
                  Sign in
                </Link>
                <button
                  onClick={setShowPricingButton}
                  style={{ fontSize: "1.05rem", border: "none", background: "transparent", cursor: "pointer", color: "var(--accent)", fontWeight: 600 }}
                  className="d-flex flex underline"
                >
                  Get Started
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
