"use client";

import Link from "next/link";
import { FaInstagram, FaFacebook } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import QuestionAnswerIcon from "@mui/icons-material/QuestionAnswer";

export default function TopFooter() {
  return (
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
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
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
          Chat Support <QuestionAnswerIcon sx={{ fontSize: "1rem", color: "inherit" }} />
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
          &copy; {new Date().getFullYear()} Opletics Inc. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
