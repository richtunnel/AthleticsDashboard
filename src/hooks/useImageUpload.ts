import { useState, useCallback } from "react";

interface UploadOptions {
  entityType?: string;
  optimize?: boolean;
  maxWidth?: number;
  quality?: number;
}

interface UploadResult {
  url: string;
  source: "upload" | "cache";
  optimized?: boolean;
  dimensions?: { width: number; height: number };
  size?: {
    bytes: number;
    formatted: string;
  };
}

interface UseImageUploadReturn {
  upload: (file: File, options?: UploadOptions) => Promise<UploadResult>;
  isUploading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Hook for uploading images to Digital Ocean Spaces via API
 *
 * Features:
 * - Automatic form data creation
 * - Progress tracking (via isUploading state)
 * - Error handling with user-friendly messages
 * - Type-safe options
 *
 * @example
 * const { upload, isUploading, error } = useImageUpload();
 *
 * const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
 *   const file = e.target.files?.[0];
 *   if (!file) return;
 *
 *   try {
 *     const result = await upload(file, {
 *       entityType: "team-logo",
 *       optimize: true,
 *       maxWidth: 800,
 *     });
 *     console.log("Uploaded to:", result.url);
 *   } catch (err) {
 *     // Error is already handled in hook state
 *   }
 * };
 */
export function useImageUpload(): UseImageUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setIsUploading(false);
  }, []);

  const upload = useCallback(
    async (file: File, options: UploadOptions = {}): Promise<UploadResult> => {
      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        if (options.entityType) {
          formData.append("entityType", options.entityType);
        }
        if (options.optimize !== undefined) {
          formData.append("optimize", String(options.optimize));
        }
        if (options.maxWidth) {
          formData.append("maxWidth", String(options.maxWidth));
        }
        if (options.quality) {
          formData.append("quality", String(options.quality));
        }

        const response = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || data.message || "Upload failed");
        }

        return {
          url: data.url,
          source: data.source,
          optimized: data.optimized,
          dimensions: data.dimensions,
          size: data.size,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to upload image";
        setError(message);
        throw new Error(message);
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  return { upload, isUploading, error, reset };
}

/**
 * Hook for multiple file uploads with batch handling
 */
export function useBatchImageUpload() {
  const [uploads, setUploads] = useState<
    Map<
      string,
      {
        status: "pending" | "uploading" | "success" | "error";
        progress: number;
        result?: UploadResult;
        error?: string;
      }
    >
  >(new Map());

  const uploadFiles = useCallback(
    async (files: File[], options: UploadOptions = {}) => {
      const entries = new Map(uploads);

      // Initialize all as pending
      files.forEach((file) => {
        entries.set(file.name, { status: "pending", progress: 0 });
      });
      setUploads(new Map(entries));

      // Upload sequentially to avoid overwhelming the server
      for (const file of files) {
        entries.set(file.name, { status: "uploading", progress: 0 });
        setUploads(new Map(entries));

        try {
          const formData = new FormData();
          formData.append("file", file);

          if (options.entityType) {
            formData.append("entityType", options.entityType);
          }
          if (options.optimize !== undefined) {
            formData.append("optimize", String(options.optimize));
          }

          const response = await fetch("/api/upload/image", {
            method: "POST",
            body: formData,
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "Upload failed");
          }

          entries.set(file.name, {
            status: "success",
            progress: 100,
            result: {
              url: data.url,
              source: data.source,
              optimized: data.optimized,
              dimensions: data.dimensions,
              size: data.size,
            },
          });
        } catch (err) {
          entries.set(file.name, {
            status: "error",
            progress: 0,
            error: err instanceof Error ? err.message : "Upload failed",
          });
        }

        setUploads(new Map(entries));
      }

      return entries;
    },
    [uploads]
  );

  const clearUpload = useCallback((filename: string) => {
    setUploads((prev) => {
      const next = new Map(prev);
      next.delete(filename);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setUploads(new Map());
  }, []);

  return {
    uploads,
    uploadFiles,
    clearUpload,
    clearAll,
  };
}
