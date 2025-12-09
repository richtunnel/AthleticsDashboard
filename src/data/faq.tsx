import * as React from "react";

const faqsData = {
  title: "FAQ's",
  // description: '',
  items: [
    {
      q: "How does this actually save me time as an athletic director, coach or staff ?",
      a: <>Our platform speeds up the process for finding game dates, synchronizing your calendar, generating and tracking eamils, artificial bus scheduling, schedule confilict detection and more.</>,
    },
    {
      q: "Explain automating my spreadsheet?",
      a: "Start by creating an account importing your spreadsheet. Use our filters, email campaigns and AI tools to quickly update, track and send your games and schedules",
    },
    {
      q: "Can I use this to keep track of data or analytics ?",
      a: "At the moment you can keep track of all your leagues scores, any email transactions and games. Financial and other types of analytics in progress.",
    },
    {
      q: "How do I get support ?",
      a: (
        <>
          We are happy to help!
          <br />
          You can reach out to us at support@opletics.com
        </>
      ),
    },
  ],
};

export default faqsData;
