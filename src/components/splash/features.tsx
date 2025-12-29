import { Box, Typography, Stack, Avatar } from "@mui/material";
import * as React from "react";

import { Section } from "../../components/splash/Section";
import { SectionTitle, SectionTitleProps } from "./section-title";
import styles from "../../styles/feature.module.css";

const Revealer = ({ children }: any) => {
  return children;
};

export interface FeaturesProps extends Omit<SectionTitleProps, "title" | "variant"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  features: Array<FeatureProps>;
  columns?: { xs?: number; sm?: number; md?: number; lg?: number; xl?: number };
  spacing?: number;
  aside?: React.ReactElement;
  reveal?: React.FC<any>;
  iconSize?: number;
  innerWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
}

export interface FeatureProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<any>;
  iconPosition?: "left" | "top";
  iconSize?: number;
  ip?: "left" | "top";
  variant?: string;
  delay?: number;
}

export const Feature: React.FC<FeatureProps> = (props) => {
  const { title, description, icon: IconComponent, iconPosition, iconSize = 32, ip, variant } = props;

  const pos = iconPosition || ip;
  const direction = pos === "left" ? "row" : "column";

  return (
    <Stack direction={direction} spacing={2} alignItems={pos === "left" ? "flex-start" : "center"}>
      {IconComponent && (
        <Avatar
          sx={{
            bgcolor: "transparent",
            width: iconSize * 1.5,
            height: iconSize * 1.5,
          }}
        >
          <IconComponent style={{ width: iconSize, height: iconSize }} />
        </Avatar>
      )}
      <Box>
        <Typography className={styles.featureSectionTitle} sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
      </Box>
    </Stack>
  );
};

export const Features: React.FC<FeaturesProps> = (props) => {
  const { title, description, features, columns = { xs: 1, sm: 2, md: 3 }, spacing = 4, align: alignProp = "center", iconSize = 32, aside, reveal: Wrap = Revealer, ...rest } = props;

  const align = !!aside ? "left" : alignProp;
  const ip = align === "left" ? "left" : "top";

  return (
    <Section sx={{ marginBottom: "120px" }} {...rest}>
      <Stack direction="row" sx={{ height: "100%" }} alignItems="flex-start">
        <Stack spacing={{ xs: 2, md: 4 }} sx={{ flex: 1 }}>
          {(title || description) && (
            <Wrap>
              <SectionTitle title={title} description={description} align={align} />
            </Wrap>
          )}
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: `repeat(${columns.xs || 1}, 1fr)`,
                sm: `repeat(${columns.sm || 2}, 1fr)`,
                md: `repeat(${columns.md || 3}, 1fr)`,
                lg: `repeat(${columns.lg || columns.md || 3}, 1fr)`,
                xl: `repeat(${columns.xl || columns.lg || columns.md || 3}, 1fr)`,
              },
              gap: spacing,
            }}
          >
            {features.map((feature, i) => {
              return (
                <Wrap key={i} delay={feature.delay}>
                  <Feature iconSize={iconSize} {...feature} ip={ip} />
                </Wrap>
              );
            })}
          </Box>
        </Stack>
        {aside && <Box sx={{ flex: 1, p: 4 }}>{aside}</Box>}
      </Stack>
    </Section>
  );
};
