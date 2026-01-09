import { Box, Container, Stack, Typography, Link, BoxProps } from "@mui/material";
import NextLink from "next/link";
import { usePathname } from "next/navigation";
import CopyRight from "../copyright";
import PartnerBuildSectionFooter from "../home/PartnerBuildFooter";
import { NewsletterSubscription } from "./NewsletterSubscription";
import LayoutFooter from "../layout/Footer";
import styles from "@/styles/footer.module.css";

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
        justifyContent: "center",
        alignItems: "end",
        paddingBottom: "20px",
      }}
      {...rest}
    >
      <Container maxWidth="xl" sx={{ px: 0, py: 4, color: "#a3abb5" }}>
        <Box
          className={styles.SpashFooterBoxContainer}
          sx={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 4,
            alignItems: "end",
          }}
        >
          <PartnerBuildSectionFooter />
          <Stack spacing={4} className={styles.bottomFooterContent}>
            <Stack className={styles.SplashFooterOptInStack} alignItems="flex-start">
              <NewsletterSubscription />
              <Stack sx={{ mt: 4 }}>
                <Box sx={{ display: "flex", mb: "12px" }}>
                  <Box component={siteConfig.logo} sx={{ flex: 1, height: "32px", justifyContent: { xs: "center", sm: "left", md: "left" } }} />
                </Box>
                <Typography variant="body1" color="#a3abb5" sx={{ mb: 0.25, fontSize: "0.875rem" }}>
                  {siteConfig.seo.description}
                </Typography>
                <Copyright>{siteConfig.footer.copyright}</Copyright>
              </Stack>
            </Stack>
            {/* Social Icons and Footer Links */}
            <Stack direction="row" justifyContent="flex-start" sx={{ marginTop: "18px!important", alignItems: "center", paddingLeft: "0!important" }}>
              <LayoutFooter />
            </Stack>
            <CopyRight />
          </Stack>
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
        </Box>
        {/* <Box sx={{ mt: 0 }}></Box> */}
      </Container>
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
