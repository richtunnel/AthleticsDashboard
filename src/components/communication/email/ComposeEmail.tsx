"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Box, Button, Card, CardContent, Divider, Snackbar, Stack, TextField, Typography, IconButton, Paper, useTheme } from "@mui/material";
import type { AlertColor } from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import PhotoCamera from "@mui/icons-material/PhotoCamera";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { LoadingButton } from "@/components/utils/LoadingButton";
import { trackEvent } from "@/lib/analytics/mixpanel.services";
import { buildEmailSignatureHTML, getSignatureLogoPreviewUrl } from "@/lib/utils/email-signature";

type SnackbarState = {
  open: boolean;
  message: string;
  severity: AlertColor;
};

const DEFAULT_SNACKBAR: SnackbarState = {
  open: false,
  message: "",
  severity: "success",
};

/**
 * Component to display signature logo with fallback to original URL if optimization fails
 * Uses consistent image loading across manager, preview, and sent emails
 */
function SignatureLogoImage({ logoUrl, baseUrl }: { logoUrl: string; baseUrl?: string }) {
  const [imgSrc, setImgSrc] = useState<string>(() => {
    try {
      return getSignatureLogoPreviewUrl(logoUrl, baseUrl);
    } catch {
      return logoUrl;
    }
  });
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset to optimized URL when logoUrl changes
    try {
      setImgSrc(getSignatureLogoPreviewUrl(logoUrl, baseUrl));
      setHasError(false);
    } catch {
      setImgSrc(logoUrl);
    }
  }, [logoUrl, baseUrl]);

  const handleError = () => {
    if (!hasError) {
      // Fallback to original URL if optimized version fails
      setImgSrc(logoUrl);
      setHasError(true);
    }
  };

  return (
    <Box
      component="img"
      src={imgSrc}
      alt="Logo preview"
      onError={handleError}
      sx={{
        maxWidth: 120,
        maxHeight: 120,
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        p: 1,
        backgroundColor: "background.paper",
        objectFit: "contain",
      }}
      loading="lazy"
    />
  );
}

interface EmailSignature {
  signaturePhone: string;
  signatureWebsite: string;
  signatureLogoUrl: string;
  signatureText: string;
}

async function fetchEmailSignature(): Promise<EmailSignature> {
  const res = await fetch("/api/user/email-signature");
  if (!res.ok) {
    throw new Error("Failed to fetch email signature");
  }
  const data = await res.json();
  return (
    data.data || {
      signaturePhone: "",
      signatureWebsite: "",
      signatureLogoUrl: "",
      signatureText: "",
    }
  );
}

async function updateEmailSignature(signature: EmailSignature): Promise<EmailSignature> {
  const res = await fetch("/api/user/email-signature", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(signature),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to update email signature");
  }
  const data = await res.json();
  return data.data.signature;
}

async function uploadLogo(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload/signature-logo", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Failed to upload logo");
  }

  const data = await res.json();
  return data.data.url;
}

export function EmailSignatureManager() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [snackbar, setSnackbar] = useState<SnackbarState>(DEFAULT_SNACKBAR);
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [signatureText, setSignatureText] = useState("");
  const [mounted, setMounted] = useState(false);

  const showMessage = (message: string, severity: AlertColor = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const hideMessage = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const { data: signature, isLoading } = useQuery<EmailSignature, Error>({
    queryKey: ["email-signature"],
    queryFn: fetchEmailSignature,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (signature) {
      setPhone(signature.signaturePhone || "");
      setWebsite(signature.signatureWebsite || "");
      setLogoUrl(signature.signatureLogoUrl || "");
      setSignatureText(signature.signatureText || "");
    }
  }, [signature]);

  const updateMutation = useMutation({
    mutationFn: updateEmailSignature,
    onSuccess: (data) => {
      queryClient.setQueryData(["email-signature"], data);
      showMessage("Email signature saved successfully!");
    },
    onError: (error: Error) => {
      showMessage(error.message, "error");
    },
  });

  const uploadMutation = useMutation({
    mutationFn: uploadLogo,
    onSuccess: (url) => {
      setLogoUrl(url);
      showMessage("Logo uploaded successfully!");
    },
    onError: (error: Error) => {
      showMessage(error.message, "error");
    },
  });

  const handleSave = () => {
    trackEvent("Email Signature Saved", {
      source: "email_manager",
      action: "save_signature",
      has_phone: Boolean(phone?.trim()),
      has_website: Boolean(website?.trim()),
      has_logo: Boolean(logoUrl?.trim()),
      has_text: Boolean(signatureText?.trim()),
    });

    updateMutation.mutate({
      signaturePhone: phone,
      signatureWebsite: website,
      signatureLogoUrl: logoUrl,
      signatureText: signatureText,
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (2MB)
    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      showMessage(`File too large (${sizeMB}MB). Maximum allowed size is 2MB. Please compress your image or use a smaller file.`, "error");
      // Reset the input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    // Validate file type by extension and MIME type for maximum browser compatibility
    const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));

    const isValidMimeType = allowedMimeTypes.includes(file.type);
    const isValidExtension = allowedExtensions.includes(fileExtension);

    // Some browsers (especially Safari on iOS) may not report HEIC MIME type correctly,
    // so we also check the file extension as a fallback
    if (!isValidMimeType && !isValidExtension) {
      showMessage(`Invalid file type "${fileExtension || file.type || "unknown"}". ` + "Only JPG, JPEG, PNG, WebP, and iPhone/Android (HEIC) images are accepted.", "error");
      // Reset the input so the same file can be selected again if needed
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    uploadMutation.mutate(file);
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
  };

  const generatePreviewHTML = () => {
    // Generate preview with optimized images enabled for faster loading
    if (!mounted) return "<p style='font-style: italic; color: #666;'>Loading preview...</p>";

    if (!phone && !website && !logoUrl && !signatureText) {
      return `<p style="color: ${theme.palette.text.secondary}; font-style: italic;">No signature configured</p>`;
    }

    // Use buildEmailSignatureHTML with optimized images for preview
    const baseUrl = typeof window !== "undefined" ? window.location.origin : undefined;
    return buildEmailSignatureHTML(
      {
        signaturePhone: phone,
        signatureWebsite: website,
        signatureLogoUrl: logoUrl,
        signatureText: signatureText,
      },
      {
        baseUrl,
        useOptimizedImages: true, // Enable optimization for preview
      },
    );
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Card>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                Email Signature
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Add a custom signature that will automatically appear at the bottom of all your emails
              </Typography>
            </Box>

            <Alert severity="info" icon={<InfoOutlinedIcon />}>
              Your signature will include your logo (max 120px), custom text, phone number, and website link.
            </Alert>

            <Divider />

            <Stack spacing={2.5}>
              {/* Logo Upload */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                  Company Logo
                </Typography>
                <Stack direction="row" spacing={2} alignItems="center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                    multiple={false}
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <Button
                    variant="outlined"
                    startIcon={<PhotoCamera />}
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadMutation.isPending}
                    sx={{
                      color: `${theme.palette.text.primary}`,
                      borderColor: theme.palette.divider,
                    }}
                  >
                    {logoUrl ? "Change Logo" : "Upload Logo"}
                  </Button>
                  {logoUrl && (
                    <>
                      <IconButton color="error" onClick={handleRemoveLogo} size="small" disabled={uploadMutation.isPending}>
                        <DeleteIcon />
                      </IconButton>
                      {mounted && <SignatureLogoImage logoUrl={logoUrl} baseUrl={typeof window !== "undefined" ? window.location.origin : undefined} />}
                    </>
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                  Recommended max size: 120px. Max file size: 2MB. Supported: JPG, JPEG, PNG, WebP, and iPhone/Android (HEIC) images
                </Typography>
              </Box>

              {/* Custom Text */}
              <TextField
                label="Signature Text"
                value={signatureText}
                onChange={(e) => setSignatureText(e.target.value)}
                placeholder="e.g., Best regards,&#10;John Smith&#10;Athletic Director"
                fullWidth
                multiline
                rows={3}
                helperText="Add custom text to your signature (e.g., name, title, greeting)"
              />

              {/* Phone Number */}
              <TextField label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g., (555) 123-4567" fullWidth helperText="Your contact phone number" />

              {/* Website */}
              <TextField
                label="Website / Link"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="e.g., https://yourschool.com or yourschool.com"
                fullWidth
                helperText="Your school or organization website (https:// is optional)"
              />
            </Stack>

            <Divider />

            {/* Preview */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1.5 }}>
                Preview (as it will appear in emails)
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.paper", minHeight: 100 }} dangerouslySetInnerHTML={{ __html: generatePreviewHTML() }} />
            </Box>

            {/* Save Button */}
            <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
              <LoadingButton
                sx={{ color: theme.palette.getContrastText(theme.palette.primary.main) }}
                startIcon={<SaveIcon />}
                loading={updateMutation.isPending}
                onClick={handleSave}
                loadingText="Saving"
                variant="contained"
              >
                Save Signature
              </LoadingButton>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={hideMessage} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert onClose={hideMessage} severity={snackbar.severity} variant="filled" sx={{ width: "100%" }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
