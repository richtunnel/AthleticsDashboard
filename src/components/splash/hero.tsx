import { Container, Box, Stack, Typography, BoxProps } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface HeroProps extends Omit<BoxProps, "title"> {
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
}

export const Hero = ({ title, description, children, ...rest }: HeroProps) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: "flex",
        py: 10,
        alignItems: "center",
        ...rest.sx,
      }}
      {...rest}
    >
      <Container>
        <Stack spacing={{ xs: 2, lg: 4 }} alignItems="flex-start" direction="column">
          <Typography variant="h1" component="h1" sx={{ textAlign: "left" }}>
            {title}
          </Typography>
          <Typography
            component="div"
            variant="h6"
            sx={{
              textAlign: "left",
              color: theme.palette.mode === "light" ? "grey.500" : "grey.400",
            }}
          >
            {description}
          </Typography>
        </Stack>
        {children}
      </Container>
    </Box>
  );
};
