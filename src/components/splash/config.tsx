import { Button } from "@mui/material";
import { Link } from "@mui/material";
import { FaGithub, FaTwitter } from "react-icons/fa";
import { FiCheck } from "react-icons/fi";
import BaseHeader from "../headers/_base";
import FacebookIcon from "@mui/icons-material/Facebook";
import { Facebook } from "@mui/icons-material";
import XIcon from "@mui/icons-material/X";
import InstagramIcon from "@mui/icons-material/Instagram";
import BaseHeaderWhite from "../headers/_baseWhite";
// Define the SEO config type since NextSeoProps isn't available
interface SeoConfig {
  title: string;
  description: string;
}

const siteConfig = {
  logo: BaseHeaderWhite,
  seo: {
    title: "AdHub",
    description: "A Smart Spreadsheet for Sports Coordinators.",
  } as SeoConfig,
  termsUrl: "#",
  privacyUrl: "#",
  header: {
    links: [
      {
        id: "features",
        label: "Features",
      },
      //   {
      //     id: "pricing",
      //     label: "Pricing",
      //   },
      {
        id: "faq",
        label: "FAQ",
      },
      {
        label: "Login",
        href: "/login",
      },
      {
        label: "Sign Up",
        href: "/signup",
        variant: "primary",
      },
    ],
  },
  footer: {
    copyright: (
      <>
        Contact Us —{" "}
        <Link style={{ color: "#fff" }} href="emailto:support@athleticdirectorhub.com" target="_blank" rel="noopener">
          support@athleticdirectorhub.com
        </Link>
      </>
    ),
    links: [
      //   {
      //     href: "mailto:support@athleticdirectorhub.com",
      //     label: "Help",
      //   },
      {
        href: "https://x.com/",
        label: <XIcon />,
      },
      {
        href: "https://instagram.com/",
        label: <InstagramIcon />,
      },
      {
        href: "https://facebook.com/",
        label: <Facebook />,
      },
    ],
  },
  signup: {
    title: "Athletic Directors Hub",
    features: [
      {
        icon: FiCheck,
        title: "Accessible",
        description: "All components strictly follow WAI-ARIA standards.",
      },
      {
        icon: FiCheck,
        title: "Themable",
        description: "Fully customize all components to your brand with theme support and style props.",
      },
      {
        icon: FiCheck,
        title: "Composable",
        description: "Compose components to fit your needs and mix them together to create new ones.",
      },
      {
        icon: FiCheck,
        title: "Productive",
        description: "Designed to reduce boilerplate and fully typed, build your product at speed.",
      },
    ],
  },
};

export default siteConfig;
