import Link from "next/link";
import { VscGithubProject } from "react-icons/vsc";
import styles from "../../styles/logo.module.css";

export default function BaseHeader() {
  return (
    <>
      <Link className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
        adhub
        <VscGithubProject />
      </Link>
    </>
  );
}
