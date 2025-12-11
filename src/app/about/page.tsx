"use client";

import Link from "next/link";
import Image from "next/image";
import styles from "../../styles/logo.module.css";
import { VscGithubProject } from "react-icons/vsc";
import Footer from "@/components/layout/Footer";

export default function AboutUsPage() {
  return (
    <div 
      className="grid h-screen lg:grid-cols-[1fr_1.2fr] grid-cols-1 text-left"
      style={{
        backgroundColor: '#fdfdfd',
        color: '#0f172a',
      }}
    >
      <div className="relative h-full lg:block hidden">
        <Image 
          src="/assets/images/conference-meeting.jpg" 
          alt="Conference Meeting" 
          fill 
          className="object-cover" 
          priority 
        />
      </div>

      <div className="flex flex-col h-full">
        <div 
          className={styles.homeHeaderContainer}
          style={{
            color: '#0f172a',
          }}
        >
          <Link 
            className={`${styles["ad-hub-logo"]} flex d-flex`} 
            href="/"
            style={{
              color: '#0f172a',
            }}
          >
            adhub
            <VscGithubProject />
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center px-4">
          <div className={styles.homePageContentContainer}>
            <h3 
              className="HomePageTitle text-5xl font-bold mb-4 leading-tight" 
              style={{ 
                color: '#0f172a',
              }}
            >
              About Us
            </h3>
            
            <h4 
              className="text-2xl font-semibold mb-2"
              style={{ 
                color: '#6d92e2',
              }}
            >
              Built by Athletic Directors and School Administrators,
            </h4>
            
            <h4 
              className="text-2xl font-semibold mb-6"
              style={{ 
                color: '#475569',
              }}
            >
              for the people who lead our programs.
            </h4>
            
            <div 
              className="text-lg mb-4" 
              style={{ 
                maxWidth: "665px", 
                padding: 0,
                color: '#0f172a',
                lineHeight: 1.8,
              }}
            >
              <p className="mb-4">
                AD Hub was created with one mission: to give athletic departments and school leadership the modern tools they deserve. After decades of watching athletic directors, coaches, and
                administrators juggle spreadsheets, emails, forms, and outdated systems, we knew the industry needed something better - something built by people who truly understand the challenges of
                running a successful school athletic program.
              </p>

              <p className="mb-4">
                With over 50 years of combined experience across athletics, school administration, education, and technology, our team brings together the people who have lived the problems and the
                experts who know how to solve them. From former athletic directors and school administrators to seasoned software professionals, we've built a platform that blends real-world insight with
                cutting-edge innovation.
              </p>

              <p className="mb-4" style={{ fontWeight: 600 }}>
                At AD Hub, you're not just in good hands, you're in experienced, trusted, industry-tested hands.
              </p>

              <p>
                We're committed to helping athletic directors and school administrators lead with confidence, reclaim their time, and elevate their programs without the administrative overwhelm. This
                isn't generic software trying to fit your world - this is a platform built specifically for it.
              </p>
            </div>
          </div>
        </div>

        <Footer />
      </div>
    </div>
  );
}
