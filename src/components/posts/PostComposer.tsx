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
const MAX_FILE_SIZE_MB = 2;
const MAX_DIMENSION = 1920;

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
      const maxBytes = MAX_FILE_SIZE_MB * 1024 * 1024;
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

interface UploadedImage {
  preview: string;
  url: string;
  key: string;
}

interface PostComposerProps {
  currentUser: { id: string; name: string | null; image: string | null };
  onPostCreated: () => void;
}

export default function PostComposer({ currentUser, onPostCreated }: PostComposerProps) {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  const [content, setContent] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = (currentUser.name || "AD")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (images.length + files.length > MAX_IMAGES) {
      setError(`Maximum ${MAX_IMAGES} images per post.`);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      for (const rawFile of files) {
        const compressed = await compressImage(rawFile);
        const preview = URL.createObjectURL(compressed);
        const fd = new FormData();
        fd.append("file", compressed);
        const res = await fetch("/api/posts/upload-image", { method: "POST", body: fd });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Upload failed");
        setImages((prev) => [...prev, { preview, url: json.data.url, key: json.data.key }]);
      }
    } catch (err: any) {
      setError(err.message || "Image upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (idx: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || undefined,
          images: images.map((i) => ({ url: i.url, key: i.key })),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "Failed to post");
      setContent("");
      setImages([]);
      onPostCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create post");
    } finally {
      setSubmitting(false);
    }
  };

  const canPost = (content.trim().length > 0 || images.length > 0) && !submitting && !uploading;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        mb: 3,
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Avatar
          src={currentUser.image || undefined}
          sx={{ width: 42, height: 42, bgcolor: "primary.main", fontSize: 14, fontWeight: 700, flexShrink: 0 }}
        >
          {initials}
        </Avatar>

        <Box sx={{ flexGrow: 1 }}>
          {/* Textarea */}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              overflow: "hidden",
              "&:focus-within": { borderColor: "primary.main", boxShadow: `0 0 0 2px ${theme.palette.primary.main}22` },
              transition: "border-color 0.15s, box-shadow 0.15s",
            }}
          >
            <textarea
              ref={textRef}
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
                padding: "12px 14px",
                fontFamily: "inherit",
                fontSize: "0.9rem",
                lineHeight: 1.6,
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

          {/* Image previews */}
          {images.length > 0 && (
            <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
              {images.map((img, idx) => (
                <Box
                  key={img.key}
                  sx={{ position: "relative", width: 80, height: 80, borderRadius: 1.5, overflow: "hidden", border: "1px solid", borderColor: "divider" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <IconButton
                    size="small"
                    onClick={() => removeImage(idx)}
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
              {uploading && (
                <Box sx={{ width: 80, height: 80, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed", borderColor: "divider", borderRadius: 1.5 }}>
                  <CircularProgress size={24} />
                </Box>
              )}
            </Box>
          )}

          {error && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
              {error}
            </Typography>
          )}

          {/* Actions row */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.5, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <Tooltip title={images.length >= MAX_IMAGES ? "Max 4 images per post" : "Add photo"}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= MAX_IMAGES || uploading}
                    color="primary"
                  >
                    <AddPhotoAlternate />
                  </IconButton>
                </span>
              </Tooltip>
              {content.length > 200 && (
                <Typography variant="caption" color={content.length > 2800 ? "error" : "text.secondary"}>
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
                {submitting ? <CircularProgress size={16} color="inherit" /> : "Post"}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
