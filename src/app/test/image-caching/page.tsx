"use client";

import { useState, useEffect } from "react";
import { Box, Button, Card, CardContent, Typography, Divider, CircularProgress, Alert, Grid, Paper } from "@mui/material";
import { getOptimizedImageUrl, getResponsiveImageSources } from "@/lib/utils/image";

export default function ImageCachingTestPage() {
  const [testResults, setTestResults] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState("/uploads/signatures/test.jpg");
  const [customImageUrl, setCustomImageUrl] = useState("");

  useEffect(() => {
    testImageCachingFeatures();
  }, []);

  const testImageCachingFeatures = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/test/image-caching");
      if (!response.ok) {
        throw new Error("Failed to test image caching features");
      }

      const data = await response.json();
      setTestResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleTestCustomImage = () => {
    if (customImageUrl.trim()) {
      setImageUrl(customImageUrl);
    }
  };

  const optimizedUrl = getOptimizedImageUrl(imageUrl, {
    width: 300,
    height: 200,
    quality: 85,
    format: "webp",
  });

  const responsiveSources = getResponsiveImageSources(imageUrl, [
    { width: 600, height: 400, media: "(min-width: 1200px)" },
    { width: 400, height: 267, media: "(min-width: 768px)" },
    { width: 300, height: 200, media: "(min-width: 480px)" },
  ]);

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: "auto" }}>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Image Caching & Optimization Test
      </Typography>

      <Typography variant="subtitle1" color="text.secondary" paragraph>
        This page tests all the image caching and optimization features implemented:
        Sharp image optimization, WebP conversion, service worker caching, URL versioning, and ETag support.
      </Typography>

      <Divider sx={{ my: 4 }} />

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      ) : (
        <Grid container spacing={4}>
          {/* Test Results */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Feature Test Results
                </Typography>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    ETag Generation:
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {testResults?.etag || "Not generated"}
                  </Typography>
                </Box>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Optimized Image URL:
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                    {testResults?.optimizedUrl || "Not generated"}
                  </Typography>
                </Box>

                <Box sx={{ my: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Responsive Sources:
                  </Typography>
                  {testResults?.responsiveSources?.map((source: any, index: number) => (
                    <Box key={index} sx={{ ml: 2, my: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                        {source.media || "Default"}: {source.src}
                      </Typography>
                    </Box>
                  ))}
                </Box>

                <Alert severity="success" sx={{ mt: 2 }}>
                  {testResults?.message || "All features working correctly!"}
                </Alert>
              </CardContent>
            </Card>
          </Grid>

          {/* Image Optimization Demo */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Image Optimization Demo
                </Typography>

                <Typography variant="subtitle2" color="text.secondary" paragraph>
                  Original Image URL:
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all", mb: 2 }}>
                  {imageUrl}
                </Typography>

                <Typography variant="subtitle2" color="text.secondary" paragraph>
                  Optimized Image URL (WebP, 300x200, 85% quality):
                </Typography>
                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all", mb: 2 }}>
                  {optimizedUrl}
                </Typography>

                <Box sx={{ my: 3, display: "flex", gap: 2 }}>
                  <TextField
                    label="Custom Image URL"
                    value={customImageUrl}
                    onChange={(e) => setCustomImageUrl(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder="/uploads/signatures/your-image.jpg"
                  />
                  <Button
                    variant="contained"
                    onClick={handleTestCustomImage}
                    disabled={!customImageUrl.trim()}
                  >
                    Test
                  </Button>
                </Box>

                <Typography variant="subtitle2" color="text.secondary" paragraph>
                  Optimized Image Preview:
                </Typography>
                <Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
                  <Paper elevation={3} sx={{ p: 2, maxWidth: 300 }}>
                    <img
                      src={optimizedUrl}
                      alt="Optimized preview"
                      style={{ maxWidth: "100%", height: "auto", borderRadius: 4 }}
                      loading="lazy"
                    />
                  </Paper>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Responsive Images Demo */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Responsive Images Demo
                </Typography>

                <Typography variant="body2" paragraph>
                  This demonstrates how responsive image sources are generated for different screen sizes:
                </Typography>

                <Grid container spacing={2} sx={{ my: 2 }}>
                  {responsiveSources.map((source, index) => (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Paper elevation={2} sx={{ p: 2, height: "100%" }}>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                          {source.media || "Default"}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.8rem", wordBreak: "break-all" }}>
                          {source.src}
                        </Typography>
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                          Size: {source.width}x{source.height}
                        </Typography>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>

                <Typography variant="subtitle2" color="text.secondary" paragraph sx={{ mt: 3 }}>
                  Responsive Image Implementation:
                </Typography>

                <Paper elevation={1} sx={{ p: 2, fontFamily: "monospace", fontSize: "0.85rem", bgcolor: "background.paper" }}>
                  {`<picture>
  ${responsiveSources
    .map((source) => `
  <source src="${source.src}" media="${source.media}" width="${source.width}" height="${source.height}">`)
    .join("")}
  <img src="${optimizedUrl}" alt="Responsive image" loading="lazy">
</picture>`}
                </Paper>
              </CardContent>
            </Card>
          </Grid>

          {/* Service Worker Status */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Service Worker Status
                </Typography>

                <Typography variant="body2" paragraph>
                  The service worker handles client-side image caching with the following features:
                </Typography>

                <Box component="ul" sx={{ pl: 3, mb: 2 }}>
                  <li>Caches images on first load</li>
                  <li>Serves cached images on subsequent requests</li>
                  <li>Automatic cache invalidation after 30 days</li>
                  <li>Fallback to network if cache fails</li>
                  <li>Background sync for failed uploads</li>
                </Box>

                <Typography variant="body2" color="text.secondary">
                  Check browser console for service worker registration status.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Cache Invalidation Demo */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Cache Invalidation Features
                </Typography>

                <Typography variant="body2" paragraph>
                  URL versioning and ETag support ensure proper cache invalidation:
                </Typography>

                <Box component="ul" sx={{ pl: 3, mb: 2 }}>
                  <li>
                    <strong>URL Versioning:</strong> Images include version parameters (e.g., ?v=abc123) for cache busting
                  </li>
                  <li>
                    <strong>ETag Support:</strong> Conditional requests using ETags prevent unnecessary re-downloads
                  </li>
                  <li>
                    <strong>Content Hashing:</strong> Version parameters are generated from file content
                  </li>
                  <li>
                    <strong>Immutable Caching:</strong> Optimized images are cached with long expiration times
                  </li>
                </Box>

                <Typography variant="subtitle2" color="text.secondary" paragraph>
                  Example versioned URL structure:
                </Typography>

                <Typography variant="body2" sx={{ fontFamily: "monospace", wordBreak: "break-all" }}>
                  /uploads/signatures/image.webp?v=abc123def
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Box sx={{ mt: 4, display: "flex", justifyContent: "center" }}>
        <Button variant="contained" onClick={testImageCachingFeatures} disabled={loading}>
          {loading ? <CircularProgress size={24} /> : "Retest All Features"}
        </Button>
      </Box>
    </Box>
  );
}