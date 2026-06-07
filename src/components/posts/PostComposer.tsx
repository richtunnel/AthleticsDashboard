"use client";

/**
 * PostComposer — upload queue architecture
 *
 * Upload pipeline
 * ───────────────
 *  1. User selects up to 4 images.
 *  2. Each image enters the queue as "pending".
 *  3. drain() starts up to CONCURRENT_LIMIT=2 uploads at a time.
 *  4. Each upload: compress → presigned PUT (fast path) → server proxy (fallback).
 *  5. Failures retry up to MAX_RETRIES=3 with exponential back-off (500 ms, 1 s, 2 s).
 *  6. After max retries an image is marked "error" with a Retry button.
 *  7. drain() is called whenever an upload settles, so the queue drains continuously.
 *
 * Draft persistence
 * ─────────────────
 *  Text is always written to localStorage on every keystroke.
 *  Images that are "done" are persisted by URL (tiny).
 *  Images that are still pending are persisted by base64 data URL; if the total
 *  serialised size would exceed the safe budget (4 MB) the oldest pending images
 *  are dropped silently — localStorage QuotaExceededError never surfaces.
 *  On mount the draft is restored: done-images reload from their CDN URL,
 *  pending-images restore their preview and re-enter the queue automatically.
 */

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  AddPhotoAlternate,
  Close,
  OpenInNew,
  Refresh,
  CheckCircle,
  ErrorOutline,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import Link from "next/link";
import ImageSlider from "./ImageSlider";

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_IMAGES = 4;
const CONCURRENT_LIMIT = 2;
const MAX_RETRIES = 3;
const MAX_UPLOAD_SIZE_MB = 5;
const COMPRESSED_TARGET_MB = 2;
const MAX_DIMENSION = 1920;

const DRAFT_TEXT_KEY = "post_draft_content";
const DRAFT_IMAGES_KEY = "post_draft_images";
const DRAFT_BUDGET_BYTES = 4 * 1024 * 1024; // 4 MB safe localStorage budget

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ── Types ────────────────────────────────────────────────────────────────────

type UploadStatus = "pending" | "compressing" | "uploading" | "done" | "error";

interface PendingImage {
  id: string;
  file: File;
  /** data: URL or blob: URL for preview; data: URL is safe to persist */
  preview: string;
  status: UploadStatus;
  attempt: number;
  uploadedUrl?: string;
  uploadedKey?: string;
  errorMsg?: string;
}

interface PostComposerProps {
  currentUser: { id: string; name: string | null; image: string | null };
  onPostCreated: () => void;
}

// ── Image compression ────────────────────────────────────────────────────────

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
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      const maxBytes = COMPRESSED_TARGET_MB * 1024 * 1024;
      const isTransparent = file.type === "image/png";
      let quality = 0.88;
      const attempt = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxBytes || quality < 0.1) {
            const ext = isTransparent ? ".png" : ".jpg";
            const mime = isTransparent ? "image/png" : "image/jpeg";
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ext), { type: mime }));
          } else { quality -= 0.12; attempt(); }
        }, isTransparent ? "image/png" : "image/jpeg", quality);
      };
      attempt();
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
    img.src = objectUrl;
  });
}

// ── Upload (presigned fast path + server proxy fallback) ─────────────────────

async function safeJson(res: Response, fallback: string): Promise<any> {
  let json: any;
  try { json = await res.json(); } catch { throw new Error(fallback); }
  if (!res.ok || !json?.success) throw new Error(json?.error || fallback);
  return json;
}

async function uploadImage(file: File): Promise<{ url: string; key: string }> {
  try {
    const presignRes = await fetch("/api/posts/upload-image/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    });
    if (presignRes.ok) {
      const { data } = await presignRes.json();
      const { uploadUrl, publicUrl, key, requiredHeaders } = (data ?? {}) as {
        uploadUrl?: string; publicUrl?: string; key?: string; requiredHeaders?: Record<string, string>;
      };
      if (uploadUrl && publicUrl && key && requiredHeaders) {
        const put = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: file });
        if (put.ok) return { url: publicUrl, key };
      }
    }
  } catch (e) {
    console.warn("[PostComposer] Presigned upload failed, falling back:", e);
  }
  const fd = new FormData();
  fd.append("file", file, file.name);
  const proxy = await fetch("/api/posts/upload-image", { method: "POST", body: fd });
  const json = await safeJson(proxy, "Image upload failed. Please try again.");
  const d = json.data as { url: string; key: string } | undefined;
  if (!d?.url || !d?.key) throw new Error("Upload returned no URL. Please try again.");
  return { url: d.url, key: d.key };
}

// ── Draft helpers ─────────────────────────────────────────────────────────────

interface PersistedImage {
  id: string;
  name: string;
  type: string;
  status: "done" | "pending";
  /** CDN URL for done images; base64 data URL for pending images */
  data: string;
}

function loadDraft(): { text: string; images: PersistedImage[] } {
  try {
    const text = localStorage.getItem(DRAFT_TEXT_KEY) || "";
    const raw = localStorage.getItem(DRAFT_IMAGES_KEY);
    const images: PersistedImage[] = raw ? JSON.parse(raw) : [];
    return { text, images };
  } catch { return { text: "", images: [] }; }
}

function saveDraft(text: string, images: PendingImage[]) {
  try {
    localStorage.setItem(DRAFT_TEXT_KEY, text);
    const entries: PersistedImage[] = [];
    let budgetUsed = 0;
    for (const img of images) {
      if (img.status === "done" && img.uploadedUrl) {
        entries.push({ id: img.id, name: img.file.name, type: img.file.type, status: "done", data: img.uploadedUrl });
      } else if (img.status !== "error" && img.preview.startsWith("data:")) {
        const sz = img.preview.length;
        if (budgetUsed + sz < DRAFT_BUDGET_BYTES) {
          entries.push({ id: img.id, name: img.file.name, type: img.file.type, status: "pending", data: img.preview });
          budgetUsed += sz;
        }
      }
    }
    localStorage.setItem(DRAFT_IMAGES_KEY, JSON.stringify(entries));
  } catch { /* non-fatal: QuotaExceededError → draft just won't persist */ }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_TEXT_KEY);
    localStorage.removeItem(DRAFT_IMAGES_KEY);
  } catch { /* ignore */ }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PostComposer({ currentUser, onPostCreated }: PostComposerProps) {
  const theme = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [images, setImages] = useState<PendingImage[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable ref mirrors for use inside async callbacks
  const imagesRef = useRef<PendingImage[]>([]);
  imagesRef.current = images;

  // Active upload count — a ref (not state) so increment/decrement don't
  // trigger re-renders and are free from React batching races.
  const activeCountRef = useRef(0);

  const initials = (currentUser.name || "AD")
    .split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // ── Upload queue ─────────────────────────────────────────────────────────

  const updateImage = useCallback((id: string, patch: Partial<PendingImage>) => {
    setImages((prev) => prev.map((img) => img.id === id ? { ...img, ...patch } : img));
  }, []);

  const uploadOne = useCallback(async (id: string) => {
    const getImg = () => imagesRef.current.find((i) => i.id === id);

    // ── Compress ──────────────────────────────────────────────────────────
    updateImage(id, { status: "compressing" });
    let compressed: File;
    try {
      const img = getImg();
      if (!img) return;
      compressed = await compressImage(img.file);
    } catch (e) {
      updateImage(id, { status: "error", errorMsg: "Compression failed." });
      return;
    }

    // ── Upload with retry ─────────────────────────────────────────────────
    updateImage(id, { status: "uploading" });
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await uploadImage(compressed);
        updateImage(id, { status: "done", uploadedUrl: result.url, uploadedKey: result.key, attempt });
        return; // success
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          await sleep(Math.pow(2, attempt - 1) * 500); // 500 ms, 1 s, 2 s
          updateImage(id, { attempt });
        } else {
          updateImage(id, {
            status: "error",
            attempt,
            errorMsg: (err as Error).message || "Upload failed after 3 attempts.",
          });
        }
      }
    }
  }, [updateImage]);

  /** Drain the queue: start uploading pending images up to CONCURRENT_LIMIT. */
  const drain = useCallback(() => {
    const pending = imagesRef.current.filter((i) => i.status === "pending");
    const slots = CONCURRENT_LIMIT - activeCountRef.current;
    const toStart = pending.slice(0, Math.max(0, slots));

    toStart.forEach((img) => {
      activeCountRef.current++;
      uploadOne(img.id).finally(() => {
        activeCountRef.current--;
        drain(); // re-drain after each upload settles
      });
    });
  }, [uploadOne]);

  // Re-drain whenever images change (covers the initial add AND retry clicks)
  useEffect(() => {
    if (images.some((i) => i.status === "pending")) drain();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.map((i) => i.id + i.status).join(",")]);

  // ── Draft persistence ─────────────────────────────────────────────────────

  // Restore on mount
  useEffect(() => {
    const { text, images: saved } = loadDraft();
    if (text) setContent(text);

    if (saved.length > 0) {
      const restored: PendingImage[] = saved.map((s) => {
        if (s.status === "done") {
          // Reconstruct a minimal File so the rest of the code stays uniform
          const file = new File([], s.name, { type: s.type });
          return {
            id: s.id, file, preview: s.data,
            status: "done" as const, attempt: 0,
            uploadedUrl: s.data, uploadedKey: "",
          };
        }
        // Pending: decode base64 back to File so we can re-compress/re-upload
        try {
          const parts = s.data.split(",");
          const byteStr = atob(parts[1]);
          const bytes = new Uint8Array(byteStr.length);
          for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
          const file = new File([bytes], s.name, { type: s.type });
          return { id: s.id, file, preview: s.data, status: "pending" as const, attempt: 0 };
        } catch {
          return null;
        }
      }).filter(Boolean) as PendingImage[];
      if (restored.length > 0) setImages(restored);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist text on every change
  useEffect(() => {
    localStorage.setItem(DRAFT_TEXT_KEY, content);
  }, [content]);

  // Persist images whenever they settle
  useEffect(() => {
    saveDraft(content, images);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images.map((i) => i.id + i.status).join(",")]);

  // ── File selection ────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!files.length) return;

    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      setError(`Maximum ${MAX_IMAGES} images per post.`);
      return;
    }

    const selected = files.slice(0, remaining);
    const maxBytes = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

    for (const file of selected) {
      if (file.type === "image/webp" || file.type === "image/avif") {
        setError("Image failed to upload. Try uploading a .png or .jpg file instead.");
        return;
      }
      if (file.size > maxBytes) {
        setError(
          `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB — please reduce it to under ${MAX_UPLOAD_SIZE_MB} MB before uploading.`
        );
        return;
      }
    }

    setError(null);

    // Convert each file to a data URL (for preview + draft persistence)
    const incoming = await Promise.all(
      selected.map(async (file) => {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => resolve(URL.createObjectURL(file));
          reader.readAsDataURL(file);
        });
        return {
          id: Math.random().toString(36).slice(2),
          file,
          preview: dataUrl,
          status: "pending" as const,
          attempt: 0,
        };
      })
    );

    setImages((prev) => [...prev, ...incoming]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img?.preview.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  };

  const retryImage = (id: string) => {
    updateImage(id, { status: "pending", errorMsg: undefined });
    // drain() will pick it up via the useEffect
  };

  // ── Post submit ───────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!content.trim() && images.length === 0) return;

    const notReady = images.filter((i) => i.status !== "done" && i.status !== "error");
    if (notReady.length > 0) {
      setError("Please wait for all images to finish uploading.");
      return;
    }
    const failed = images.filter((i) => i.status === "error");
    if (failed.length > 0) {
      setError("Some images failed to upload. Remove or retry them before posting.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const uploaded = images
        .filter((i) => i.status === "done" && i.uploadedUrl && i.uploadedKey)
        .map((i) => ({ url: i.uploadedUrl!, key: i.uploadedKey! }));

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() || undefined, images: uploaded }),
      });
      await safeJson(res, "Failed to create post. Please try again.");

      images.forEach((img) => {
        if (img.preview.startsWith("blob:")) URL.revokeObjectURL(img.preview);
      });
      clearDraft();
      setContent("");
      setImages([]);
      onPostCreated();
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Derived state ─────────────────────────────────────────────────────────

  const allDone = images.length > 0 && images.every((i) => i.status === "done");
  const anyUploading = images.some((i) => i.status === "compressing" || i.status === "uploading" || i.status === "pending");
  const anyError = images.some((i) => i.status === "error");
  const canPost = (content.trim().length > 0 || allDone) && !submitting && !anyUploading;

  const sliderImages = images.map((img) => ({
    url: img.status === "done" && img.uploadedUrl ? img.uploadedUrl : img.preview,
    alt: img.file.name,
  }));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2.5 }, mb: 3, borderRadius: 3,
        border: "1px solid", borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: { xs: 1, sm: 1.5 }, alignItems: "flex-start" }}>
        {/* Avatar */}
        <Avatar
          src={currentUser.image || undefined}
          sx={{ width: { xs: 36, sm: 42 }, height: { xs: 36, sm: 42 }, bgcolor: "#1e293b", color: "#ffffff", fontSize: { xs: 12, sm: 14 }, fontWeight: 700, flexShrink: 0 }}
        >
          {initials}
        </Avatar>

        <Box sx={{ flexGrow: 1, width: "100%" }}>
          {/* Textarea */}
          <Box
            sx={{
              border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden",
              "&:focus-within": { borderColor: "primary.main", boxShadow: `0 0 0 2px ${theme.palette.primary.main}22` },
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
                width: "100%", border: "none", outline: "none", resize: "none",
                padding: "10px 12px", fontFamily: "inherit", fontSize: "0.875rem",
                lineHeight: 1.55, background: "transparent", color: theme.palette.text.primary, boxSizing: "border-box",
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
          </Box>

          {/* Image slider preview */}
          {images.length > 0 && (
            <Box sx={{ mt: 1.5, position: "relative" }}>
              <ImageSlider images={sliderImages} aspectRatio="1/1" rounded />

              {/* Per-image status overlay pills */}
              <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
                {images.map((img, i) => (
                  <Box
                    key={img.id}
                    sx={{
                      display: "flex", alignItems: "center", gap: 0.5,
                      px: 1, py: 0.4, borderRadius: 10, fontSize: "0.7rem", fontWeight: 600,
                      bgcolor: img.status === "done"
                        ? alpha(theme.palette.success.main, 0.12)
                        : img.status === "error"
                          ? alpha(theme.palette.error.main, 0.12)
                          : alpha(theme.palette.primary.main, 0.1),
                      color: img.status === "done" ? "success.dark"
                        : img.status === "error" ? "error.main"
                          : "primary.main",
                    }}
                  >
                    {(img.status === "compressing" || img.status === "uploading" || img.status === "pending") && (
                      <CircularProgress size={10} color="inherit" />
                    )}
                    {img.status === "done" && <CheckCircle sx={{ fontSize: 12 }} />}
                    {img.status === "error" && <ErrorOutline sx={{ fontSize: 12 }} />}
                    <span>
                      {img.status === "pending" ? "Queued" : ""}
                      {img.status === "compressing" ? "Compressing…" : ""}
                      {img.status === "uploading" ? `Uploading${img.attempt > 1 ? ` (retry ${img.attempt - 1})` : ""}…` : ""}
                      {img.status === "done" ? `Photo ${i + 1}` : ""}
                      {img.status === "error" ? "Failed" : ""}
                    </span>
                    {img.status === "error" && (
                      <Tooltip title="Retry upload">
                        <IconButton size="small" onClick={() => retryImage(img.id)} sx={{ p: 0.1, color: "error.main" }}>
                          <Refresh sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    <IconButton
                      size="small"
                      onClick={() => removeImage(img.id)}
                      disabled={submitting}
                      sx={{ p: 0.1, color: "text.disabled", "&:hover": { color: "text.primary" } }}
                    >
                      <Close sx={{ fontSize: 11 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {error && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
              {error}
            </Typography>
          )}

          {/* Actions row */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mt: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif"
                multiple
                style={{ display: "none" }}
                onChange={handleFileChange}
              />
              <Tooltip
                title={
                  images.length >= MAX_IMAGES
                    ? `Max ${MAX_IMAGES} photos per post`
                    : `Add photos (up to ${MAX_IMAGES - images.length} more)`
                }
              >
                <span>
                  <IconButton
                    size="small"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={images.length >= MAX_IMAGES || submitting}
                    color="primary"
                  >
                    <AddPhotoAlternate />
                  </IconButton>
                </span>
              </Tooltip>

              {anyUploading && (
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.72rem" }}>
                  Uploading…
                </Typography>
              )}
              {anyError && !anyUploading && (
                <Typography variant="caption" color="error" sx={{ fontSize: "0.72rem" }}>
                  Some images need attention
                </Typography>
              )}

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
