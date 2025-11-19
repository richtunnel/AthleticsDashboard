"use client";

import React, { Component, ReactNode } from "react";
import { Box, Button, Typography, Paper, Alert } from "@mui/material";
import { Error as ErrorIcon, Refresh } from "@mui/icons-material";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * ErrorBoundary Component
 * 
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI instead of the
 * component tree that crashed.
 * 
 * Usage:
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showDetails = false } = this.props;

    if (hasError) {
      // Custom fallback UI
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "400px",
            p: 4,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 600,
              width: "100%",
              textAlign: "center",
            }}
          >
            <ErrorIcon
              sx={{
                fontSize: 64,
                color: "error.main",
                mb: 2,
              }}
            />
            <Typography variant="h5" gutterBottom fontWeight={600}>
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.
            </Typography>

            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={this.handleReset}
              sx={{ mr: 2 }}
            >
              Try Again
            </Button>
            <Button
              variant="outlined"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>

            {showDetails && error && (
              <Alert severity="error" sx={{ mt: 3, textAlign: "left" }}>
                <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                  Error Details:
                </Typography>
                <Typography variant="body2" component="pre" sx={{ fontSize: "0.75rem", overflow: "auto" }}>
                  {error.toString()}
                </Typography>
                {errorInfo && (
                  <>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2 }} gutterBottom>
                      Component Stack:
                    </Typography>
                    <Typography variant="body2" component="pre" sx={{ fontSize: "0.75rem", overflow: "auto" }}>
                      {errorInfo.componentStack}
                    </Typography>
                  </>
                )}
              </Alert>
            )}
          </Paper>
        </Box>
      );
    }

    return children;
  }
}
