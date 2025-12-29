"use client";

import React, { useState } from "react";
import { Box, TextField, Button, Typography, Alert, CircularProgress } from "@mui/material";

export const NewsletterSubscription = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        // Check if user was already subscribed or newly subscribed
        if (response.status === 200) {
          setMessage({ text: data.message, type: "info" });
        } else {
          setMessage({ text: data.message, type: "success" });
          setEmail(""); // Clear input on successful new subscription
        }
      } else {
        setMessage({ text: data.error || "Subscription unsuccessful. Please try again.", type: "error" });
      }
    } catch (error) {
      console.error("Subscription error:", error);
      setMessage({ text: "Subscription unsuccessful. Please try again later.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ mt: 4, width: "100%", maxWidth: 492 }}>
      <Typography variant="body1" sx={{ mb: 2, color: "#a3abb5" }}>
        Stay updated with the latest features and news!
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubscribe}
        sx={{
          display: "flex",
          gap: 1,
          flexDirection: { xs: "column", sm: "row" },
        }}
      >
        <TextField
          fullWidth
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
          sx={{
            flex: 1,
            "& .MuiOutlinedInput-root": {
              bgcolor: "#1a1d35",
              color: "#fff",
              "& fieldset": {
                borderColor: "#2d3250",
              },
              "&:hover fieldset": {
                borderColor: "#4a5083",
              },
              "&.Mui-focused fieldset": {
                borderColor: "primary.main",
              },
              "& input": {
                color: "#fff",
              },
              "& input::placeholder": {
                color: "#a3abb5",
                opacity: 0.7,
              },
            },
          }}
        />
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          sx={{
            minWidth: 120,
            height: 56,
            bgcolor: "primary.main",
            "&:hover": {
              bgcolor: "primary.dark",
            },
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Subscribe"}
        </Button>
      </Box>

      {message && (
        <Alert
          severity={message.type}
          onClose={() => setMessage(null)}
          sx={{
            mt: 2,
            bgcolor: message.type === "success" ? "rgba(46, 125, 50, 0.1)" : message.type === "error" ? "rgba(211, 47, 47, 0.1)" : "rgba(2, 136, 209, 0.1)",
            color: message.type === "success" ? "#66bb6a" : message.type === "error" ? "#f44336" : "#29b6f6",
            "& .MuiAlert-icon": {
              color: message.type === "success" ? "#66bb6a" : message.type === "error" ? "#f44336" : "#29b6f6",
            },
          }}
        >
          {message.text}
        </Alert>
      )}
    </Box>
  );
};
