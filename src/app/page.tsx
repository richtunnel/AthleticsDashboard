import Link from "next/link";
import Image from "next/image";
import styles from "../styles/logo.module.css";
import { VscGithubProject } from "react-icons/vsc";

export default function HomePage() {
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

        <div className="flex h-full items-center justify-center">
          <div className={`${styles.homePageContentContainer}`}>
            <h3 className="text-5xl font-bold text-gray-900 mb-4">
              Athletic <br /> Directors Hub
            </h3>
            <p style={{ maxWidth: "665px", padding: "0px" }} className="text-xl text-gray-600 mb-8">
              A smart spreadsheet allowing athletic directors to automate, process and manage athletic schedules with ease.{" "}
            </p>
            <Link href="/api/auth/signin" style={{ backgroundColor: "#b4fc66", color: "#000" }} className="inline-block px-8 py-3 text-white rounded-lg font-medium transition">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
