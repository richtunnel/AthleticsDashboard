"use client";

import Link from "next/link";
import { FaInstagram, FaFacebook } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { usePathname } from "next/navigation";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";
import styles from "@/styles/footer.module.css";

export default function Footer() {
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  return (
    <footer
      style={{
        padding: "0rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        alignItems: "left",
        marginTop: "0",
      }}
      className={styles.SplashFooterCTA}
    >
      <div style={{ display: "flex", gap: "1rem", alignItems: "left" }}>
        <a
          href="https://www.instagram.com/opletics"
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
          href="https://facebook.com/opletics"
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
          href="https://x.com/opletics"
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
      <div className={styles.SplashFooterLinks} style={{ display: "flex", gap: "1rem", alignItems: "left", flexWrap: "wrap", justifyContent: "left" }}>
        <Link
          href="/about"
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
          About Us
        </Link>
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
          href="/incident-response"
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
          Incident Response
        </Link>
        <Link
          href="/disclaimer"
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
          Disclaimer
        </Link>
        <Link
          href="/careers"
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
          Careers
        </Link>
        {isHomepage && (
          <Link
            href="/members"
            style={{
              color: "#a3abb5",
              fontSize: "0.875rem",
              fontWeight: 400,
              textDecoration: "none",
              transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#ceff77")}
            onMouseOut={(e) => (e.currentTarget.style.color = "var(--text-secondary)")}
          >
            members
          </Link>
        )}
        <a
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
          target="_blank"
          rel="noopener noreferrer"
        >
          Chat Support <QuestionAnswerIcon sx={{ fontSize: "1rem", color: "inherit" }} />
        </a>
      </div>
      {/* <div>
        <span
          style={{
            color: "var(--text-secondary)",
            fontSize: "0.75rem",
            fontWeight: 400,
          }}
        >
          &copy; {new Date().getFullYear()} Opletics Inc. All rights reserved.
        </span>
      </div> */}
    </footer>
  );
}
