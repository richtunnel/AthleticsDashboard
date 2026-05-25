"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, ClickAwayListener, IconButton, Popper, Typography, type PopperPlacementType } from "@mui/material";
import { Close } from "@mui/icons-material";
import { useTips } from "@/contexts/TipsContext";
import type { TipId } from "./tipIds";

export interface TipBubbleProps {
  tipId: TipId;
  /** The element the bubble should point at. Pass `ref.current` or controlled state. */
  anchorEl: HTMLElement | null;
  title: string;
  body: string;
  /** Default: "bottom". Popper will flip if there isn't room. */
  placement?: PopperPlacementType;
  /** CTA label on the dismissal button. Default: "Got it". */
  ctaLabel?: string;
}

function TipBubbleImpl({ tipId, anchorEl, title, body, placement = "bottom", ctaLabel = "Got it" }: TipBubbleProps) {
  const { isDismissed, dismiss, isLoading, requestSlot, releaseSlot, activeTipId, sessionHide, isSessionHidden } = useTips();

  const dismissed = isDismissed(tipId);
  const sessionHidden = isSessionHidden(tipId);

  // ── Pure derivation of visibility eligibility ───────────────────────────
  // Reads directly from context. Survives full parent re-renders and identity losses.
  const eligible = !isLoading && !dismissed && !sessionHidden && !!anchorEl;

  // ── Queue registration ──────────────────────────────────────────────────
  useEffect(() => {
    if (!eligible) return;
    requestSlot(tipId);
    return () => releaseSlot(tipId);
  }, [eligible, tipId, requestSlot, releaseSlot]);

  // Only the queue head is allowed to render its popper.
  const isMyTurn = eligible && activeTipId === tipId;

  // PopperJS modifiers — memoised so Popper doesn't re-instantiate on every render.
  const modifiers = useMemo(
    () => [
      { name: "offset", options: { offset: [0, 12] } },
      { name: "preventOverflow", options: { padding: 12, altAxis: true } },
      { name: "flip", options: { padding: 12, fallbackPlacements: ["top", "bottom", "right", "left"] } },
      { name: "arrow", enabled: false },
    ],
    [],
  );

  // Pure evaluation short-circuit: zero delayed states or layout frame hangs.
  if (!isMyTurn) return null;

  return (
    <Popper open={true} anchorEl={anchorEl} placement={placement} modifiers={modifiers} disablePortal={false} style={{ zIndex: 1400 }}>
      <Box>
        <ClickAwayListener mouseEvent="onMouseDown" touchEvent="onTouchStart" onClickAway={() => sessionHide(tipId)}>
          <Box
            role="dialog"
            aria-label={title}
            sx={{
              position: "relative",
              maxWidth: 320,
              minWidth: 220,
              p: 1.75,
              pr: 4.5,
              borderRadius: 1.5,
              bgcolor: "background.paper",
              color: "text.primary",
              border: "1px solid",
              borderColor: "divider",
              boxShadow: (theme) => (theme.palette.mode === "dark" ? "0 6px 24px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4)" : "0 6px 24px rgba(15, 23, 42, 0.18), 0 1px 3px rgba(15, 23, 42, 0.1)"),
              "&::before, &::after": {
                content: '""',
                position: "absolute",
                width: 0,
                height: 0,
                pointerEvents: "none",
              },
            }}
          >
            <ArrowForPopper initialPlacement={placement} />

            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: "text.primary", pr: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.45, mb: 1.25 }}>
              {body}
            </Typography>

            <Button
              size="small"
              variant="contained"
              onClick={() => dismiss(tipId)}
              sx={{
                bgcolor: (theme) => (theme.palette.mode === "dark" ? "#2e3478" : "#181B38"),
                color: "#fff",
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.78rem",
                py: 0.5,
                px: 1.5,
                boxShadow: "none",
                "&:hover": {
                  bgcolor: (theme) => (theme.palette.mode === "dark" ? "#3a4196" : "#23275a"),
                  boxShadow: "none",
                },
              }}
            >
              {ctaLabel}
            </Button>

            <IconButton
              size="small"
              aria-label="Close tip"
              onClick={() => sessionHide(tipId)}
              sx={{
                position: "absolute",
                top: 4,
                right: 4,
                color: "text.secondary",
                p: 0.5,
                "&:hover": { color: "text.primary", bgcolor: "action.hover" },
              }}
            >
              <Close sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>
        </ClickAwayListener>
      </Box>
    </Popper>
  );
}

/**
 * ArrowForPopper remains unchanged, handling structural flips safely on mount.
 */
function ArrowForPopper({ initialPlacement }: { initialPlacement: PopperPlacementType }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initialSide = useMemo<"top" | "bottom" | "left" | "right">(() => {
    const base = initialPlacement.split("-")[0] as "top" | "bottom" | "left" | "right";
    return base === "bottom" ? "top" : base === "top" ? "bottom" : base === "right" ? "left" : "right";
  }, [initialPlacement]);
  const [side, setSide] = useState(initialSide);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    let popperRoot: HTMLElement | null = node.parentElement;
    while (popperRoot && !popperRoot.hasAttribute("data-popper-placement")) {
      popperRoot = popperRoot.parentElement;
    }
    if (!popperRoot) return;

    const readPlacement = () => {
      const placement = popperRoot!.getAttribute("data-popper-placement") || "bottom";
      const base = placement.split("-")[0] as "top" | "bottom" | "left" | "right";
      setSide(base === "bottom" ? "top" : base === "top" ? "bottom" : base === "right" ? "left" : "right");
    };
    readPlacement();

    const observer = new MutationObserver(readPlacement);
    observer.observe(popperRoot, { attributes: true, attributeFilter: ["data-popper-placement"] });
    return () => observer.disconnect();
  }, []);

  const arrowStyles = useMemo(() => {
    const size = 8;
    const common = {
      position: "absolute" as const,
      width: 0,
      height: 0,
      pointerEvents: "none" as const,
    };

    switch (side) {
      case "top":
        return {
          border: {
            ...common,
            top: -size - 1,
            left: "50%",
            transform: "translateX(-50%)",
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderBottomWidth: `${size}px`,
            borderBottomStyle: "solid" as const,
          },
          fill: {
            ...common,
            top: -size,
            left: "50%",
            transform: "translateX(-50%)",
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderBottomWidth: `${size}px`,
            borderBottomStyle: "solid" as const,
          },
        };
      case "bottom":
        return {
          border: {
            ...common,
            bottom: -size - 1,
            left: "50%",
            transform: "translateX(-50%)",
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderTopWidth: `${size}px`,
            borderTopStyle: "solid" as const,
          },
          fill: {
            ...common,
            bottom: -size,
            left: "50%",
            transform: "translateX(-50%)",
            borderLeft: `${size}px solid transparent`,
            borderRight: `${size}px solid transparent`,
            borderTopWidth: `${size}px`,
            borderTopStyle: "solid" as const,
          },
        };
      case "left":
        return {
          border: {
            ...common,
            left: -size - 1,
            top: "50%",
            transform: "translateY(-50%)",
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderRightWidth: `${size}px`,
            borderRightStyle: "solid" as const,
          },
          fill: {
            ...common,
            left: -size,
            top: "50%",
            transform: "translateY(-50%)",
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderRightWidth: `${size}px`,
            borderRightStyle: "solid" as const,
          },
        };
      case "right":
        return {
          border: {
            ...common,
            right: -size - 1,
            top: "50%",
            transform: "translateY(-50%)",
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderLeftWidth: `${size}px`,
            borderLeftStyle: "solid" as const,
          },
          fill: {
            ...common,
            right: -size,
            top: "50%",
            transform: "translateY(-50%)",
            borderTop: `${size}px solid transparent`,
            borderBottom: `${size}px solid transparent`,
            borderLeftWidth: `${size}px`,
            borderLeftStyle: "solid" as const,
          },
        };
    }
  }, [side]);

  return (
    <Box ref={containerRef} aria-hidden sx={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Box
        aria-hidden
        sx={{
          ...arrowStyles.border,
          borderColor: (theme) =>
            side === "top"
              ? `transparent transparent ${theme.palette.divider} transparent`
              : side === "bottom"
                ? `${theme.palette.divider} transparent transparent transparent`
                : side === "left"
                  ? `transparent ${theme.palette.divider} transparent transparent`
                  : `transparent transparent transparent ${theme.palette.divider}`,
        }}
      />
      <Box
        aria-hidden
        sx={{
          ...arrowStyles.fill,
          borderColor: (theme) =>
            side === "top"
              ? `transparent transparent ${theme.palette.background.paper} transparent`
              : side === "bottom"
                ? `${theme.palette.background.paper} transparent transparent transparent`
                : side === "left"
                  ? `transparent ${theme.palette.background.paper} transparent transparent`
                  : `transparent transparent transparent ${theme.palette.background.paper}`,
        }}
      />
    </Box>
  );
}

export const TipBubble = memo(TipBubbleImpl);
