import { Grid, Box, Typography } from "@mui/material";

import { Section, SectionProps } from "../../components/splash/Section";
import { SectionTitle } from "./section-title";

interface FaqProps extends Omit<SectionProps, "title" | "children"> {
  title?: React.ReactNode;
  description?: React.ReactNode;
  items: { q: React.ReactNode; a: React.ReactNode }[];
}

export const Faq: React.FC<FaqProps> = (props) => {
  const { title = "FAQ's", description, items = [] } = props;

  return (
    <Section id="faq" sx={{ marginBottom: "50px" }}>
      <SectionTitle align="left" title={title} description={description} />
      <br />
      <br />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 2.5, md: 5 },
          columnGap: { xs: 0, md: 5 },
        }}
      >
        {items?.map(({ q, a }, i) => {
          return <FaqItem key={i} question={q} answer={a} />;
        })}
      </Box>
    </Section>
  );
};

export interface FaqItemProps {
  question: React.ReactNode;
  answer: React.ReactNode;
}

const FaqItem: React.FC<FaqItemProps> = ({ question, answer }) => {
  return (
    <Box component="dl">
      <Typography component="dt" fontWeight="600" sx={{ mb: 1 }}>
        {question}
      </Typography>
      <Typography component="dd" color="text.secondary" sx={{ m: 0 }}>
        {answer}
      </Typography>
    </Box>
  );
};
