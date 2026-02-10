"use client";

import Link from "next/link";
import { Box, SxProps, Theme } from "@mui/material";
import { VscGithubProject } from "react-icons/vsc";
import styles from "../../styles/logo.module.css";
import { CircularProjectIcon } from "../circle-logo/OpleticsLogo";

interface BaseHeaderWhiteProps {
  pt?: string;
  pl?: string;
  sx?: SxProps<Theme>;
  href?: string;
  iconSize?: number;
  color?: string;
  fontSize?: string;
  [key: string]: any; // Allow any other props
}

export default function BaseHeaderWhite({ pt, pl, sx, fontSize, iconSize = 20, useGradient, ...props }: BaseHeaderWhiteProps) {
  return (
    <>
      <Box
        className={`${styles["ad-hub-logo"]} flex d-flex`}
        sx={{
          paddingTop: pt,
          paddingLeft: pl,
          textDecoration: "none",
          display: "flex",
          alignItems: "center",
          ...sx, // Merge custom sx props
        }}
        {...props} // Spread remaining props
      >
        <Link style={{ color: "#fff" }} className={`${styles["ad-hub-logo"]}`} href="/">
          <CircularProjectIcon size={iconSize} useGradient={useGradient} color="#fff" />
          <span style={{ marginLeft: "2.5px", color: "#fff" }}>opletics</span>
        </Link>
      </Box>
    </>
  );
}
