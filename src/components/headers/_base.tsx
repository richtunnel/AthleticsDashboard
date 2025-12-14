"use client";

import Link from "next/link";
import { VscGithubProject } from "react-icons/vsc";
import styles from "../../styles/logo.module.css";
import { CircularProjectIcon } from "../circle-logo/OpleticsLogo";

interface addPadding {
  pt?: string;
  pl?: string;
}

export default function BaseHeader({ pt, pl }: addPadding) {
  return (
    <>
      <Link style={{ paddingTop: `${pt}`, paddingLeft: `${pl}` }} className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
        <CircularProjectIcon />
        <span style={{ marginLeft: "2.5px" }}>opletics</span>
      </Link>
    </>
  );
}
