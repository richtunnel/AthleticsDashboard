import { Box, Container, Stack, Typography, Link, BoxProps, Grid } from "@mui/material";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import CopyRight from "../copyright";
import PartnerBuildSectionFooter from "../home/PartnerBuildFooter";
import { NewsletterSubscription } from "./NewsletterSubscription";
import LayoutFooter from "../layout/Footer";
import styles from "@/styles/footer.module.css";
import Disclaimer from "./disclaimer";

import siteConfig from "./config";

export interface FooterProps extends Omit<BoxProps, "children"> {
  columns?: number;
  children?: React.ReactNode;
}

export const Footer: React.FC<FooterProps> = (props) => {
  const { columns = 1, ...rest } = props;
  const pathname = usePathname();
  const isHomepage = pathname === "/";

  return (
    <Box
      className={styles.SpashFooterBoxWrapper}
      sx={{
        bgcolor: "#0e1125",
        color: "#a3abb5",
        minHeight: "250px",
        display: "flex",
        justifyContent: "left",
        alignItems: "end",
        paddingBottom: "20px",
        position: "relative", // REQUIRED for absolute positioning
        overflow: "hidden", // REQUIRED to hide the "submerged" part of the logo
      }}
      {...rest}
    >
      <Container sx={{ maxWidth: { lg: "1585px" }, paddingLeft: { md: "20px!important" }, paddingRight: { md: "20px!important" }, py: 4, color: "#a3abb5" }}>
        <Box
          className={styles.SpashFooterBoxContainer}
          sx={{
            alignItems: "end",
          }}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 8 }}>
              <PartnerBuildSectionFooter />
            </Grid>
            <Grid sx={{ display: "flex", justifyContent: "center", alignItems: "center" }} size={{ xs: 12, md: 4 }}>
              <Stack spacing={4} className={styles.bottomFooterContent}>
                <Disclaimer />
              </Stack>
              {/* Social Icons and Footer Links */}
              {/* <Stack direction="row" justifyContent="flex-start" sx={{ marginTop: "18px!important", alignItems: "center", paddingLeft: "0!important" }}>
                <LayoutFooter />
              </Stack>
              <CopyRight /> */}
            </Grid>

            {/* <Stack direction="row" justifyContent="flex-end" spacing={2} sx={{ alignItems: "center", paddingLeft: "0!important" }}>
            {siteConfig.footer?.links?.map(({ href, label }) => (
              <FooterLink key={href} href={href}>
                {label}
              </FooterLink>
            ))}
          </Stack> */}

            {/* <Stack>
            <CopyRight />
          </Stack> */}
          </Grid>
        </Box>
        {/* <Box sx={{ mt: 0 }}></Box> */}
      </Container>
      <Box
        sx={{
          position: "absolute",
          bottom: "-58px", // Adjust this value to hide more/less of the logo
          right: { xs: "50%", sm: "40px" }, // Center on mobile, right-aligned on desktop
          transform: { xs: "translateX(50%)", sm: "none" },
          opacity: 0.1,
          zIndex: 0,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <Box
          component={siteConfig.logo}
          useGradient={true}
          sx={{
            height: "170px",
            width: "auto",
            "& span": {
              fontSize: "10.75rem",
              lineHeight: 1,
              backgroundImage: "linear-gradient(to right top, #1b2044, #00558a, #008ea3, #00c37a, #a8eb12)",
              WebkitBackgroundClip: "text", // Clips background to the text
              WebkitTextFillColor: "transparent", // Makes original text color invisible
              backgroundClip: "text",
              color: "transparent",
            },
            "& svg": {
              height: "160px",
              width: "auto",
              marginRight: "10px",
            },
          }}
        />
      </Box>
    </Box>
  );
};

export interface CopyrightProps {
  title?: React.ReactNode;
  children: React.ReactNode;
}

export const Copyright: React.FC<CopyrightProps> = ({ title, children }: CopyrightProps) => {
  let content;
  if (title && !children) {
    content = `© ${new Date().getFullYear()} - ${title}`;
  }
  return (
    <Typography variant="body2" color="#a3abb5">
      {content || children}
    </Typography>
  );
};

export interface FooterLinkProps {
  href: string;
  children: React.ReactNode;
}

export const FooterLink: React.FC<FooterLinkProps> = (props) => {
  const { children, href, ...rest } = props;

  return (
    <Link
      component={NextLink}
      href={href}
      color="#a3abb5"
      sx={{
        fontSize: "body2.fontSize",
        textDecoration: "none",
        color: "#a3abb5",
        transition: "color 0.2s ease-in",
        "&:hover": {
          color: "primary.main",
        },
      }}
      {...rest}
    >
      {children}
    </Link>
  );
};
