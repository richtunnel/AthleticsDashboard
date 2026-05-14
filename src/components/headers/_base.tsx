"use client";

import Link from "next/link";
import { VscGithubProject } from "react-icons/vsc";
import styles from "../../styles/logo.module.css";
import { CircularProjectIcon } from "../circle-logo/OpleticsLogo";
import { Box } from "@mui/material";

interface addPadding {
  pt?: string;
  pl?: string;
  children?: React.ReactNode;
}

export default function BaseHeader({ pt, pl, children }: addPadding) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingTop: pt,
        paddingLeft: pl,
        paddingRight: "20px",
      }}
    >
      <Link className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
        <CircularProjectIcon outerStrokeWidth={2} strokeWidth={4} />
        <span style={{ marginLeft: "2px", letterSpacing: "-0.65px" }}>opletics</span>
      </Link>
      {children}
    </Box>
  );
}
