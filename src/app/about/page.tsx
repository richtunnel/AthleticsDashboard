"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "../../styles/logo.module.css";
import { VscGithubProject } from "react-icons/vsc";
import { FaInstagram, FaFacebook } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

export default function AboutUsPage() {
  return (
    <div 
      className="grid h-screen lg:grid-cols-[1fr_1.2fr] grid-cols-1 text-left"
      style={{
        // Force light mode colors
        backgroundColor: '#fdfdfd',
        color: '#0f172a',
      }}
    >
      {/* Left side - Conference Meeting Image */}
      <div className="relative h-full lg:block hidden">
        <Image 
          src="/assets/images/conference-meeting.jpg" 
          alt="Conference Meeting" 
          fill 
          className="object-cover" 
          priority 
        />
      </div>

      {/* Right side - Content */}
      <div className="flex flex-col h-full">
        {/* Logo Header */}
        <div 
          className={styles.homeHeaderContainer}
          style={{
            // Force light mode colors for logo
            color: '#0f172a',
          }}
        >
          <Link 
            className={`${styles["ad-hub-logo"]} flex d-flex`} 
            href="/"
            style={{
              // Force light mode colors for logo
              color: '#0f172a',
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 700,
              color: "text.primary",
              mb: 2,
            }}
          >
            About Us
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: "primary.main",
              mb: 1,
            }}
          >
            Built by Athletic Directors and School Administrators,
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: "text.secondary",
            }}
          >
            adhub
            <VscGithubProject />
          </Link>
        </div>

        {/* Main Content - Centered */}
        <div className="flex flex-1 items-center justify-center px-4">
          <div className={styles.homePageContentContainer}>
            <h3 
              className="text-5xl font-bold mb-4 leading-tight" 
              style={{ 
                // Force light mode colors
                color: '#0f172a',
              }}
            >
              About Us
            </h3>
            
            <h4 
              className="text-2xl font-semibold mb-1"
              style={{
                color: 'var(--main-blue)',
              }}
            >
              Built by athletic directors and school administrators,
            </h4>
            
            <h4 
              className="text-2xl font-semibold mb-6"
              style={{
                color: '#475569',
              }}
            >
              for the people who lead our programs.
            </h4>

            <p 
              className="text-lg mb-4" 
              style={{ 
                maxWidth: "665px", 
                lineHeight: "1.8",
                color: '#0f172a',
              }}
            >
              AD Hub was created with one mission: to give athletic departments and school leadership the modern tools they deserve. After decades of watching athletic directors, coaches, and administrators juggle spreadsheets, emails, forms, and outdated systems, we knew the industry needed something better - something built by people who truly understand the challenges of running a successful school athletic program.
            </p>
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="body1"
            paragraph
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.8,
              color: "text.primary",
            }}
          >
            AD Hub was created with one mission: to give athletic departments and school leadership the modern tools they deserve. After decades of watching athletic directors, coaches, and
            administrators juggle spreadsheets, emails, forms, and outdated systems, we knew the industry needed something better - something built by people who truly understand the challenges of
            running a successful school athletic program.
          </Typography>

          <Typography
            variant="body1"
            paragraph
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.8,
              color: "text.primary",
            }}
          >
            With over 50 years of combined experience across athletics, school administration, education, and technology, our team brings together the people who have lived the problems and the
            experts who know how to solve them. From former athletic directors and school administrators to seasoned software professionals, we've built a platform that blends real-world insight with
            cutting-edge innovation.
          </Typography>

            <p 
              className="text-lg mb-4" 
              style={{ 
                maxWidth: "665px", 
                lineHeight: "1.8",
                color: '#0f172a',
              }}
            >
              With over 50 years of combined experience across athletics, school administration, education, and technology, our team brings together the people who have lived the problems and the experts who know how to solve them. From former athletic directors and school administrators to seasoned software professionals, we've built a platform that blends real-world insight with cutting-edge innovation.
            </p>

          <Typography
            variant="body1"
            paragraph
            sx={{
              fontSize: "1.125rem",
              lineHeight: 1.8,
              color: "text.primary",
            }}
          >
            We're committed to helping athletic directors and school administrators lead with confidence, reclaim their time, and elevate their programs without the administrative overwhelm. This
            isn't generic software trying to fit your world - this is a platform built specifically for it.
          </Typography>
        </Box>

        {/* Social Icons Footer */}
        <footer
          style={{
            padding: "1.5rem 1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
            alignItems: "center",
            marginTop: "auto",
          }}
        >
          <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
            <a
              href="https://www.instagram.com/athleticdirectorhub"
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
              href="https://facebook.com/athleticdirectorhub"
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
              href="https://x.com/athleticdirectorhub"
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
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 400,
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
                fontWeight: 400,
                textDecoration: "none",
                transition: "color 0.2s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Privacy
            </Link>
            <Link
              href="/support"
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.875rem",
                fontWeight: 400,
                textDecoration: "none",
                transition: "color 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
            >
              Chat Support
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
              &copy; {new Date().getFullYear()} Athletic Director Hub. All rights reserved.
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
