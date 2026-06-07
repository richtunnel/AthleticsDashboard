"use client";

/**
 * ImageSlider
 *
 * A zero-dependency Instagram-style slider.
 *
 * Mechanics
 * ─────────
 * • CSS `transform: translateX` on a flex track — GPU composited, no layout.
 * • Transition disabled while dragging so the track follows the finger exactly.
 * • Touch AND mouse drag both supported (unified pointer-down/move/up path).
 * • Velocity-aware: a fast swipe (< 250 ms) needs only 30 px to change slides.
 * • Dot indicators animate their width on the active index (Instagram-style).
 * • Left/right arrow buttons visible on desktop, hidden on touch devices.
 * • Keyboard: ArrowLeft / ArrowRight when the slider is focused.
 * • Supports both Next.js <Image> (CDN URLs) and raw <img> (data-URL previews).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, IconButton } from "@mui/material";
import { ChevronLeft, ChevronRight } from "@mui/icons-material";
import Image from "next/image";

export interface SliderImage {
  /** CDN / absolute URL  →  rendered via next/image (optimised).
   *  data: URL or blob: URL  →  rendered via plain <img> (preview). */
  url: string;
  alt?: string;
}

interface ImageSliderProps {
  images: SliderImage[];
  /** CSS aspect-ratio value, e.g. "1/1", "4/5", "16/9". Default "1/1". */
  aspectRatio?: string;
  rounded?: boolean;
  onSlideChange?: (index: number) => void;
}

const MIN_SWIPE_PX = 50;       // minimum drag distance at normal speed
const FAST_SWIPE_PX = 30;      // minimum at high velocity
const FAST_SWIPE_MS = 250;     // max duration to be considered "fast"
const DOT_SIZE = 6;
const DOT_ACTIVE_W = 18;

export default function ImageSlider({
  images,
  aspectRatio = "1/1",
  rounded = true,
  onSlideChange,
}: ImageSliderProps) {
  const [index, setIndex] = useState(0);
  const [dragOffset, setDragOffset] = useState(0);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const lockAxis = useRef<"x" | "y" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const count = images.length;

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(count - 1, next));
      setIndex(clamped);
      setDragOffset(0);
      onSlideChange?.(clamped);
    },
    [count, onSlideChange]
  );

  // ── Pointer handling (mouse + touch unified) ─────────────────────────────

  const onPointerDown = (clientX: number, clientY: number) => {
    isDragging.current = true;
    startX.current = clientX;
    startY.current = clientY;
    startTime.current = Date.now();
    lockAxis.current = null;
  };

  const onPointerMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging.current) return;
      const dx = clientX - startX.current;
      const dy = clientY - startY.current;

      // Axis lock: decide on first meaningful movement
      if (!lockAxis.current) {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
          lockAxis.current = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
        }
        return;
      }
      if (lockAxis.current !== "x") return;

      // Resist overscroll past the first/last slide
      const resistance = index === 0 && dx > 0 ? 0.3
        : index === count - 1 && dx < 0 ? 0.3
        : 1;
      setDragOffset(dx * resistance);
    },
    [index, count]
  );

  const onPointerUp = useCallback(
    (clientX: number) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      if (lockAxis.current !== "x") {
        setDragOffset(0);
        return;
      }

      const dx = clientX - startX.current;
      const elapsed = Date.now() - startTime.current;
      const threshold = elapsed < FAST_SWIPE_MS ? FAST_SWIPE_PX : MIN_SWIPE_PX;

      if (dx < -threshold) go(index + 1);
      else if (dx > threshold) go(index - 1);
      else setDragOffset(0);
    },
    [index, go]
  );

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) =>
    onPointerDown(e.touches[0].clientX, e.touches[0].clientY);

  const handleTouchMove = (e: React.TouchEvent) => {
    if (lockAxis.current === "x") e.preventDefault(); // prevent page scroll
    onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) =>
    onPointerUp(e.changedTouches[0].clientX);

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => onPointerDown(e.clientX, e.clientY);

  useEffect(() => {
    const moveHandler = (e: MouseEvent) => onPointerMove(e.clientX, e.clientY);
    const upHandler = (e: MouseEvent) => onPointerUp(e.clientX);

    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", upHandler);
    return () => {
      window.removeEventListener("mousemove", moveHandler);
      window.removeEventListener("mouseup", upHandler);
    };
  }, [onPointerMove, onPointerUp]);

  // Keyboard
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); go(index - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); go(index + 1); }
  };

  if (count === 0) return null;

  // Single image — no slider chrome needed
  if (count === 1) {
    const img = images[0];
    const isDataUrl = img.url.startsWith("data:") || img.url.startsWith("blob:");
    return (
      <Box
        sx={{
          aspectRatio,
          overflow: "hidden",
          borderRadius: rounded ? 2 : 0,
          bgcolor: "action.hover",
          position: "relative",
        }}
      >
        {isDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.url} alt={img.alt ?? "Post image"} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <Image src={img.url} alt={img.alt ?? "Post image"} fill sizes="(max-width: 800px) 100vw, 800px" style={{ objectFit: "cover" }} />
        )}
      </Box>
    );
  }

  const isTransitioning = !isDragging.current;
  const translateX = `calc(${-index * 100}% + ${dragOffset}px)`;

  return (
    <Box
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Image ${index + 1} of ${count}. Use arrow keys to navigate.`}
      role="region"
      sx={{
        position: "relative",
        userSelect: "none",
        outline: "none",
        cursor: isDragging.current ? "grabbing" : "grab",
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2, borderRadius: rounded ? 2 : 0 },
        borderRadius: rounded ? 2 : 0,
        overflow: "hidden",
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slide track */}
      <Box
        sx={{
          display: "flex",
          width: "100%",
          transform: `translateX(${translateX})`,
          transition: isTransitioning ? "transform 0.28s cubic-bezier(0.4,0,0.2,1)" : "none",
          willChange: "transform",
          aspectRatio,
        }}
      >
        {images.map((img, i) => {
          const isDataUrl = img.url.startsWith("data:") || img.url.startsWith("blob:");
          const isNear = Math.abs(i - index) <= 1; // lazy: only render ±1
          return (
            <Box
              key={i}
              sx={{
                flex: "0 0 100%",
                minWidth: 0,
                position: "relative",
                overflow: "hidden",
                bgcolor: "action.hover",
              }}
            >
              {isNear && (
                isDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={img.url}
                    alt={img.alt ?? `Image ${i + 1}`}
                    draggable={false}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", pointerEvents: "none" }}
                  />
                ) : (
                  <Image
                    src={img.url}
                    alt={img.alt ?? `Image ${i + 1}`}
                    fill
                    sizes="(max-width: 800px) 100vw, 800px"
                    style={{ objectFit: "cover", pointerEvents: "none" }}
                    draggable={false}
                    priority={i === 0}
                  />
                )
              )}
            </Box>
          );
        })}
      </Box>

      {/* Arrow buttons — desktop only (hidden on touch) */}
      {index > 0 && (
        <IconButton
          onClick={(e) => { e.stopPropagation(); go(index - 1); }}
          aria-label="Previous image"
          size="small"
          sx={{
            position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)",
            bgcolor: "rgba(0,0,0,0.45)", color: "#fff",
            "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
            display: { xs: "none", sm: "inline-flex" },
            zIndex: 2,
          }}
        >
          <ChevronLeft fontSize="small" />
        </IconButton>
      )}
      {index < count - 1 && (
        <IconButton
          onClick={(e) => { e.stopPropagation(); go(index + 1); }}
          aria-label="Next image"
          size="small"
          sx={{
            position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
            bgcolor: "rgba(0,0,0,0.45)", color: "#fff",
            "&:hover": { bgcolor: "rgba(0,0,0,0.65)" },
            display: { xs: "none", sm: "inline-flex" },
            zIndex: 2,
          }}
        >
          <ChevronRight fontSize="small" />
        </IconButton>
      )}

      {/* Dot indicators */}
      <Box
        sx={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: 0.75, zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {images.map((_, i) => (
          <Box
            key={i}
            sx={{
              height: DOT_SIZE,
              width: i === index ? DOT_ACTIVE_W : DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              bgcolor: i === index ? "#fff" : "rgba(255,255,255,0.55)",
              transition: "width 0.25s cubic-bezier(0.4,0,0.2,1), background-color 0.25s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
            }}
          />
        ))}
      </Box>

      {/* Slide counter badge (top-right) */}
      <Box
        sx={{
          position: "absolute", top: 8, right: 10,
          bgcolor: "rgba(0,0,0,0.45)", color: "#fff",
          fontSize: "0.7rem", fontWeight: 700,
          borderRadius: 10, px: 1, py: 0.25,
          lineHeight: 1.4, zIndex: 2,
          pointerEvents: "none",
        }}
      >
        {index + 1}/{count}
      </Box>
    </Box>
  );
}
