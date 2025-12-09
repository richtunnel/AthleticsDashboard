"use client";

import Link from "next/link";
import { VscGithubProject } from "react-icons/vsc";
import styles from "../../styles/logo.module.css";

interface addPadding {
  pt?: string;
  pl?: string;
}

export default function BaseHeaderWhite({ pt, pl }: addPadding) {
  return (
    <>
      <Link style={{ color: "#fff", paddingTop: `${pt}`, paddingLeft: `${pl}` }} className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
        adhub
        <VscGithubProject />
      </Link>
    </>
  );
}
