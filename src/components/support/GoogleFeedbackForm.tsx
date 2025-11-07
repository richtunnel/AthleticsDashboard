"use client";

import { Box, Typography, Paper, Alert, Button } from "@mui/material";
import { useState } from "react";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface GoogleFeedbackFormProps {
  formUrl: string;
  title?: string;
  description?: string;
  showFallbackLink?: boolean;
}

export function GoogleFeedbackForm({ 
  formUrl, 
  title = "Share Your Feedback", 
  description = "We value your feedback! Please let us know how we can improve your experience.",
  showFallbackLink = true 
}: GoogleFeedbackFormProps) {
  const [iframeError, setIframeError] = useState(false);

  // Convert regular Google Forms URL to embeddable URL
  const getEmbedUrl = (url: string) => {
    try {
      // Handle different Google Forms URL formats
      if (url.includes('/viewform')) {
        return url.replace('/viewform', '/viewform?embedded=true');
      } else if (url.includes('forms.gle')) {
        // Short URLs need to be opened in new tab
        return null;
      }
      return `${url}?embedded=true`;
    } catch {
      return null;
    }
  };

  const embedUrl = getEmbedUrl(formUrl);
  const shouldShowIframe = embedUrl && !iframeError;

  const handleOpenInNewTab = () => {
    window.open(formUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Box sx={{ maxWidth: { xs: "100%", md: 800 } }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {description}
        </Typography>
      </Box>

      {/* Open in new tab button */}
      {showFallbackLink && (
        <Button
          variant="outlined"
          startIcon={<OpenInNewIcon />}
          onClick={handleOpenInNewTab}
          sx={{ mb: 2 }}
        >
          Open in New Tab
        </Button>
      )}

      {/* Embedded Form */}
      {shouldShowIframe ? (
        <Paper 
          elevation={0} 
          sx={{ 
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            height: { xs: 800, md: 1000 }
          }}
        >
          <iframe
            src={embedUrl}
            width="100%"
            height="100%"
            frameBorder="0"
            marginHeight={0}
            marginWidth={0}
            title="Feedback Form"
            onError={() => setIframeError(true)}
            style={{
              border: 'none',
              width: '100%',
              height: '100%'
            }}
          >
            Loading feedback form...
          </iframe>
        </Paper>
      ) : (
        <Alert severity="info" sx={{ mt: 2 }}>
          Unable to embed the form. Please{' '}
          <Button 
            size="small" 
            onClick={handleOpenInNewTab}
            sx={{ textTransform: 'none', textDecoration: 'underline', minWidth: 'auto', p: 0 }}
          >
            click here to open it in a new tab
          </Button>
          .
        </Alert>
      )}
    </Box>
  );
}
