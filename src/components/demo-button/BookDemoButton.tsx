import React from "react";
import { ButtonLink } from "../splash/button-link";
import { FiArrowRight } from "react-icons/fi";

const BookDemoButton = () => {
  return (
    <ButtonLink
      size="large"
      href="#"
      variant="outlined"
      endIcon={<FiArrowRight />}
      sx={{
        "& .MuiButton-endIcon": {
          transition: "transform 0.2s",
        },
        "&:hover .MuiButton-endIcon": {
          transform: "translateX(4px)",
        },
      }}
    >
      Book a demo
    </ButtonLink>
  );
};

export default BookDemoButton;
