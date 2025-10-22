"use client";
import Link from "next/link";
import { useState } from "react";
import Image from "next/image";
import styles from "../styles/logo.module.css";
import { VscGithubProject } from "react-icons/vsc";
import SignUpPlan from "./onboarding/plans/page";

export default function HomePage() {
  const [showPricing, setShowPricing] = useState(false);

  const setShowPricingButton = (e: any) => {
    e.preventDefault();
    setShowPricing((prev) => !prev);
  };

  return (
    <div className="grid h-screen grid-cols-[1fr_1.2fr] text-left">
      <div className="relative h-full">
        <Image src="/assets/images/green-energy.jpg" alt="Athletics Dashboard Illustration" fill className="object-cover" priority />
      </div>

      <div>
        <div className={`${styles.homeHeaderContainer}`}>
          <Link className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
            adhub
            <VscGithubProject />
          </Link>

          <Link href="/">Need Help ?</Link>
        </div>

        <div className={`flex h-full items-center justify-center`}>
          {showPricing ? (
            <>
              <SignUpPlan clickBack={setShowPricingButton} />
            </>
          ) : (
            <div className={`${styles.homePageContentContainer}`}>
              <h3 className="text-5xl font-bold text-gray-900 mb-4">
                Athletic <br /> Directors Hub
              </h3>
              <p style={{ maxWidth: "665px", padding: "0px" }} className="text-xl text-gray-600 mb-8">
                A smart spreadsheet allowing athletic directors to automate, process and manage athletic schedules with ease.{" "}
              </p>
              <div className="d-flex flex content-center items-center">
                <Link
                  href="/dashboard/games"
                  style={{ backgroundColor: "#b4fc66", color: "#000", fontWeight: "600" }}
                  className="inline-block px-8 py-3 text-white rounded-lg font-medium transition flex mx-[14px]"
                >
                  Sign in
                </Link>
                <button
                  onClick={setShowPricingButton}
                  style={{ fontSize: "1.05rem", border: "none", background: "transparent", cursor: "pointer" }}
                  className="d-flex flex text-decoration-line underline font-medium"
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
