"use client";

import { useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import { AddPhotoAlternate, Close, OpenInNew } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";

const MAX_IMAGES = 4;
// Hard upload ceiling — must match the server-side MAX_FILE_SIZE in both
// /api/posts/upload-image and /api/posts/upload-image/presign. Files larger
// than this are rejected at selection time (clearer than failing later).
const MAX_UPLOAD_SIZE_MB = 5;
// Target size for the compressed output. The iterative quality reducer below
// drops JPEG quality in 0.12 steps until the encoded blob fits.
const COMPRESSED_TARGET_SIZE_MB = 2;
const MAX_DIMENSION = 1920;
const SEPARATOR = "rgba(227,227,227,1)";

async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
        if (w >= h) { h = Math.round((h * MAX_DIMENSION) / w); w = MAX_DIMENSION; }
        else { w = Math.round((w * MAX_DIMENSION) / h); h = MAX_DIMENSION; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const maxBytes = COMPRESSED_TARGET_SIZE_MB * 1024 * 1024;
      const isTransparent = file.type === "image/png";
      let quality = 0.88;
      const attempt = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            if (blob.size <= maxBytes || quality < 0.1) {
              const ext = isTransparent ? ".png" : ".jpg";
              const mime = isTransparent ? "image/png" : "image/jpeg";
              resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: mime }));
            } else {
              quality -= 0.12;
              attempt();
            }
          },
          isTransparent ? "image/png" : "image/jpeg",
          quality
        );
      };
      attempt();
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

interface PendingImage {
  id: string;
  file: File;
  preview: string;
}

interface PostComposerProps {
  currentUser: { id: string; name: string | null; image: string | null };
  onPostCreated: () => void;
}

export default function PostComposer({ currentUser, onPostCreated }: PostComposerProps) {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = (currentUser.name || "AD")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Stage images for preview without uploading yet
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (pendingImages.length + files.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images per post.`);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    // Reject files larger than the upload ceiling at selection time so the
    // user gets immediate feedback rather than waiting for the server to
    // reject the request after compression. The server still enforces the
    // same limit as a defense-in-depth check.
    const maxBytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024;
    const oversized = files.find((f) => f.size > maxBytes);
    if (oversized) {
      setError(
        `"${oversized.name}" is ${(oversized.size / 1024 / 1024).toFixed(1)} MB — max ${MAX_UPLOAD_SIZE_MB} MB per image.`
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setError(null);
    const incoming: PendingImage[] = files.map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      preview: URL.createObjectURL(file),
    }));
    setPendingImages((prev) => [...prev, ...incoming]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = (id: string) => {
    setPendingImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  /** Safely parse a fetch response as JSON; throws a clean message on any failure. */
  async function safeJson(res: Response, fallback: string): Promise<any> {
    let json: any;
    try {
      json = await res.json();
    } catch {
      throw new Error(fallback);
    }
    if (!res.ok || !json?.success) {
      throw new Error(json?.error || fallback);
    }
    return json;
  }

  /**
   * Upload one image through the server-proxy route only. Same-origin POST,
   * no presigned URLs, no direct-to-S3 PUT. Slower (bytes go through Node)
   * but bulletproof — no CORS, no SW interference, no signature drama.
   */
  async function uploadImage(file: File): Promise<{ url: string; key: string }> {
    const fd = new FormData();
    fd.append("file", file, file.name);
    const proxyRes = await fetch("/api/posts/upload-image", {
      method: "POST",
      body: fd,
    });
    const proxyJson = await safeJson(
      proxyRes,
      "Image upload failed. Please try again."
    );
    const data = proxyJson.data as { url: string; key: string } | undefined;
    if (!data?.url || !data?.key) {
      throw new Error("Image upload returned no URL. Please try again.");
    }
    return { url: data.url, key: data.key };
  }

  // Compress → upload via Node proxy (in parallel) → create post
  const handleSubmit = async () => {
    if (!content.trim() && pendingImages.length === 0) return;
    setSubmitting(true);
    setError(null);

    try {
      // Compress all images in parallel (CPU-bound on the client)
      const compressed = await Promise.all(
        pendingImages.map((p) => compressImage(p.file))
      );

      // Upload all compressed images in parallel through the same-origin proxy.
      const uploaded = await Promise.all(compressed.map((file) => uploadImage(file)));

      // Create the post
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || undefined,
          images: uploaded,
        }),
      });
      await safeJson(res, "Failed to create post. Please try again.");

      // Clean up previews and reset
      pendingImages.forEach((img) => URL.revokeObjectURL(img.preview));
      setContent("");
      setPendingImages([]);
      onPostCreated();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = (content.trim().length > 0 || pendingImages.length > 0) && !submitting;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2.5 },
        mb: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* On mobile: avatar sits above the textarea. On sm+: side-by-side. */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 1, sm: 1.5 }, alignItems: "flex-start" }}>
        {/* Avatar */}
        <Avatar
          src={currentUser.image || undefined}
          sx={{
            width: { xs: 36, sm: 42 },
            height: { xs: 36, sm: 42 },
            bgcolor: "#1e293b",
            color: "#ffffff",
            fontSize: { xs: 12, sm: 14 },
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {initials}
        </Avatar>

        <Box sx={{ flexGrow: 1, width: "100%" }}>
          {/* Textarea */}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
              "&:focus-within": {
                borderColor: "primary.main",
                boxShadow: `0 0 0 2px ${theme.palette.primary.main}22`,
              },
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          >
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Share an update, news, or moment with fellow ADs…"
              maxLength={3000}
              rows={3}
              style={{
                width: "100%",
                border: "none",
                outline: "none",
                resize: "none",
                padding: "10px 12px",
                fontFamily: "inherit",
                fontSize: "0.875rem",
                lineHeight: 1.55,
                background: "transparent",
                color: theme.palette.text.primary,
                boxSizing: "border-box",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
          </Box>

          {/* Image previews — shown immediately after selection, before upload */}
          {pendingImages.length > 0 && (
            <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
              {pendingImages.map((img) => (
                <Box
                  key={img.id}
                  sx={{
                    position: "relative",
                    width: 80,
                    height: 80,
                    borderRadius: 1.5,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.preview}
                    alt={`Image preview ${pendingImages.indexOf(img) + 1}`}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <IconButton
                    size="small"
                    onClick={() => removeImage(img.id)}
                    aria-label={`Remove image ${pendingImages.indexOf(img) + 1}`}
                    disabled={submitting}
                    sx={{
                      position: "absolute",
                      top: 2,
                      right: 2,
                      bgcolor: "rgba(0,0,0,0.55)",
                      color: "#fff",
                      padding: "2px",
                      "&:hover": { bgcolor: "rgba(0,0,0,0.8)" },
                    }}
                  >
                    <Close sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
            </Box>
          )}

          {error && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
              {error}
            </Typography>
          )}

          {/* Actions row */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mt: 1.5,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <Tooltip
                title={
                  pendingImages.length >= MAX_IMAGES
                    ? "Max 4 images per post"
                    : "Add photo (preview shown before posting)"
                }
              >
                <span>
                  <IconButton
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={pendingImages.length >= MAX_IMAGES || submitting}
                    color="primary"
                  >
                    <AddPhotoAlternate />
                  </IconButton>
                </span>
              </Tooltip>
              {content.length > 200 && (
                <Typography
                  variant="caption"
                  color={content.length > 2800 ? "error" : "text.secondary"}
                >
                  {content.length}/3000
                </Typography>
              )}
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Button
                component={Link}
                href="/news"
                target="_blank"
                size="small"
                endIcon={<OpenInNew sx={{ fontSize: 14 }} />}
                sx={{ fontSize: 12, color: "text.secondary", textTransform: "none" }}
              >
                View news feed
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleSubmit}
                disabled={!canPost}
                sx={{ borderRadius: 4, px: 2.5, fontWeight: 600, textTransform: "none" }}
              >
                {submitting ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  "Post"
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
