"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  ClickAwayListener,
  Fade,
  IconButton,
  Popper,
  Typography,
  type PopperPlacementType,
} from "@mui/material";
import { Close } from "@mui/icons-material";
import { useTips } from "@/contexts/TipsContext";
import type { TipId } from "./tipIds";

/**
 * TipBubble
 *
 * A floating comment-style hint that anchors to an existing UI element and
 * points at it with a small triangular arrow. Designed for first-login
 * onboarding tips:
 *
 *   - Persistence:   reads/writes `dismissedTips` through TipsContext, so the
 *                    bubble only ever appears once per user (until they reset
 *                    from Settings > Other).
 *   - Queueing:      multiple TipBubbles on the same page show **one at a
 *                    time** in JSX/mount order. Each bubble requests a slot
 *                    from TipsContext when eligible; only the head of the
 *                    queue renders its popper. This prevents bubbles from
 *                    overlapping and stops ClickAway/CTA on one bubble from
 *                    accidentally dismissing another (since only one is
 *                    actually mounted at any moment).
 *   - Atomic exit:   dismissal is wired through `Fade.onExited`, so the
 *                    persistence write (which would otherwise re-render and
 *                    unmount the popper mid-animation) only fires after the
 *                    fade-out completes. No flash on dismissal.
 *   - Positioning:   MUI Popper with `flip` + `preventOverflow` modifiers so
 *                    the bubble never escapes the viewport or covers
 *                    unrelated content.
 *   - Dark mode:     theme tokens (background.paper, divider, text.*) with a
 *                    manually-painted arrow that inherits the bubble's
 *                    background and border colours.
 *   - Stability:     `memo`'d. The provider exposes stable callbacks so this
 *                    component only re-renders when its own props change.
 */

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
  /** Optional override — extra delay before showing (ms). Default 350ms so it doesn't pop in jarringly. */
  showDelayMs?: number;
}

function TipBubbleImpl({
  tipId,
  anchorEl,
  title,
  body,
  placement = "bottom",
  ctaLabel = "Got it",
  showDelayMs = 350,
}: TipBubbleProps) {
  const { isDismissed, dismiss, isLoading, requestSlot, releaseSlot, activeTipId } = useTips();

  const dismissed = isDismissed(tipId);

  // `softDismissed` blocks the bubble for this page session only — set when
  // the user clicks the X or outside the bubble. We don't persist it: the tip
  // returns on next page load. Kept in local state so it doesn't affect any
  // other TipBubble on the page.
  const [softDismissed, setSoftDismissed] = useState(false);

  // Eligibility: this bubble would render if it could get a slot in the queue.
  const eligible = !isLoading && !dismissed && !softDismissed && !!anchorEl;

  // ── Queue registration ──────────────────────────────────────────────────
  // Register whenever eligible; release when eligibility flips false (which
  // happens both on dismissal and on the bubble's React-unmount, because the
  // effect's cleanup runs in both cases). `requestSlot`/`releaseSlot` are
  // reference-stable so this effect never re-runs spuriously.
  useEffect(() => {
    if (!eligible) return;
    requestSlot(tipId);
    return () => releaseSlot(tipId);
  }, [eligible, tipId, requestSlot, releaseSlot]);

  // Only the queue head is allowed to render its popper. Everyone else
  // returns `null` so there are never two bubbles in the DOM at the same
  // time — which also means a ClickAway on one bubble can't accidentally
  // close another.
  const isMyTurn = eligible && activeTipId === tipId;

  // ── Local Popper open state ─────────────────────────────────────────────
  // Separate from `isMyTurn` so the fade-out animation has time to play
  // before we lose our slot.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isMyTurn) {
      // If we lose our turn (e.g. eligibility flipped, or another bubble
      // jumped the queue), close cleanly — Fade handles the animation.
      setOpen(false);
      return;
    }
    // Short delay so the bubble doesn't pop in as soon as the page renders.
    const t = window.setTimeout(() => setOpen(true), showDelayMs);
    return () => window.clearTimeout(t);
  }, [isMyTurn, showDelayMs]);

  // ── Atomic exit ─────────────────────────────────────────────────────────
  // `dismiss(tipId)` triggers an optimistic cache write that flips
  // `dismissed` to true and unmounts the popper immediately. If we called it
  // synchronously with the CTA click, the unmount would interrupt Fade's
  // exit animation and cause a visible "snap". Instead, the CTA only flips
  // `open` to false; the actual persistence runs in `Fade.onExited`, after
  // the animation finishes. The ref tracks which exit reason (CTA vs soft)
  // applies, since both paths funnel through the same Fade callback.
  const pendingActionRef = useRef<"cta" | "soft" | null>(null);

  const handleCTA = () => {
    pendingActionRef.current = "cta";
    setOpen(false);
  };

  const handleSoftClose = () => {
    pendingActionRef.current = "soft";
    setOpen(false);
  };

  const handleExited = () => {
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action === "cta") {
      // Persistent dismissal — server + cache update. The cache update will
      // flip `dismissed` true, eligibility false, and the queue effect's
      // cleanup will release our slot so the next bubble can take its turn.
      dismiss(tipId);
    } else if (action === "soft") {
      // Session-only dismissal. Set local state — its dep in `eligible`
      // makes the registration effect cleanup release the slot for us.
      setSoftDismissed(true);
    }
    // If `action` is null, the close was driven by losing our turn (e.g.
    // page navigation, anchor disappeared). The cleanup that closed us has
    // already released our slot, so there's nothing to do here.
  };

  // PopperJS modifiers — memoised so Popper doesn't re-instantiate on every
  // parent render.
  const modifiers = useMemo(
    () => [
      { name: "offset", options: { offset: [0, 12] } },
      { name: "preventOverflow", options: { padding: 12, altAxis: true } },
      { name: "flip", options: { padding: 12, fallbackPlacements: ["top", "bottom", "right", "left"] } },
      // Arrow positioning is handled by our own painted triangle below; we
      // still let PopperJS know about the arrow element so it doesn't drift
      // off the anchor when scrolling.
      { name: "arrow", enabled: false },
    ],
    []
  );

  // Bubbles that aren't currently the active queue head emit nothing.
  // This is the load-bearing line that prevents a ClickAway/CTA on one
  // bubble from interfering with another — there's only ever one in the DOM.
  if (!isMyTurn) return null;

  // Arrow direction is derived from the *actual* resolved placement (PopperJS
  // sets data-popper-placement on the popper element). We render four
  // triangles and rely on the CSS attribute selector to show only the
  // correct one. This keeps the arrow correct after a flip without an extra
  // render pass.
  return (
    <Popper
      open={open}
      anchorEl={anchorEl}
      placement={placement}
      modifiers={modifiers}
      // Render in a portal so the bubble can escape transformed/overflow:hidden
      // containers but still stay positioned relative to the anchor.
      disablePortal={false}
      // Above MUI Dialogs (1300) and Drawers (1200), below modals at 1500.
      style={{ zIndex: 1400 }}
      transition
      // `keepMounted` so the Popper stays in the tree through the fade-out
      // animation; Fade calls `onExited` once the opacity reaches 0.
      keepMounted
    >
      {({ TransitionProps }) => (
        <Fade {...TransitionProps} timeout={180} onExited={handleExited}>
          <Box>
            <ClickAwayListener
              mouseEvent="onMouseDown"
              touchEvent="onTouchStart"
              onClickAway={handleSoftClose}
            >
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
                  boxShadow: (theme) =>
                    theme.palette.mode === "dark"
                      ? "0 6px 24px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.4)"
                      : "0 6px 24px rgba(15, 23, 42, 0.18), 0 1px 3px rgba(15, 23, 42, 0.1)",
                  // ── Arrow painted with two stacked triangles (border + fill)
                  //    to match the bubble's border on both light + dark.
                  //    Direction switches based on PopperJS's data attribute.
                  "&::before, &::after": {
                    content: '""',
                    position: "absolute",
                    width: 0,
                    height: 0,
                    pointerEvents: "none",
                  },
                }}
                // We rely on the parent Popper's data attribute by reading it
                // via the inline style hook on the wrapping div below.
              >
                <ArrowForPopper initialPlacement={placement} />

                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, mb: 0.5, color: "text.primary", pr: 0.5 }}
                >
                  {title}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", lineHeight: 1.45, mb: 1.25 }}
                >
                  {body}
                </Typography>

                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCTA}
                  sx={{
                    bgcolor: (theme) =>
                      theme.palette.mode === "dark" ? "#2e3478" : "#181B38",
                    color: "#fff",
                    textTransform: "none",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    py: 0.5,
                    px: 1.5,
                    boxShadow: "none",
                    "&:hover": {
                      bgcolor: (theme) =>
                        theme.palette.mode === "dark" ? "#3a4196" : "#23275a",
                      boxShadow: "none",
                    },
                  }}
                >
                  {ctaLabel}
                </Button>

                {/* Soft close (X) — dismisses for the session only, same as
                    ClickAway. Persistence requires the CTA. */}
                <IconButton
                  size="small"
                  aria-label="Close tip"
                  onClick={handleSoftClose}
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
        </Fade>
      )}
    </Popper>
  );
}

/**
 * ArrowForPopper
 *
 * Renders a small triangle that points at the anchor. To stay correct across
 * PopperJS auto-flips we:
 *
 *   1. Attach a ref to the arrow's container.
 *   2. On mount, walk UP from that node to the nearest ancestor carrying
 *      `data-popper-placement` (the popper root) — this scopes us to OUR
 *      popper even when multiple TipBubbles are open simultaneously.
 *   3. Observe attribute mutations on that ancestor so the arrow flips when
 *      PopperJS re-positions on scroll or resize.
 *
 * The arrow is painted in CSS (no SVG) so it picks up `background.paper` and
 * `divider` automatically through theme tokens — no dark-mode override needed.
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

    // Walk up to the popper root (the element PopperJS sets the attribute on).
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

    // Updates are rare (flip on scroll/resize), so a single observer is cheap.
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
          // Border triangle (slightly larger, behind)
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
          // Fill triangle (smaller, in front)
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
            // Only colour the relevant edge; the others stay transparent.
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
