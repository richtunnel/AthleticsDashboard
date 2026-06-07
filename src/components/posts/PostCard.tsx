"use client";

import { useState, useRef } from "react";
import {
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  CircularProgress,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  Button,
} from "@mui/material";
import {
  MoreHoriz,
  Delete,
  School,
  Favorite,
  FavoriteBorder,
  BookmarkBorder,
  Bookmark,
  ChatBubbleOutline,
  Share,
  Send,
} from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { formatDistanceToNow } from "date-fns";
import Image from "next/image";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ImageSlider from "./ImageSlider";

export interface PostAuthor {
  id: string;
  name: string | null;
  image: string | null;
  schoolName: string | null;
  role: string;
}

export interface PostImageData {
  id: string;
  url: string;
  key: string;
}

export interface PostData {
  id: string;
  content: string | null;
  createdAt: string;
  author: PostAuthor;
  images: PostImageData[];
  likeCount?: number;
  saveCount?: number;
  commentCount?: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

interface PostCardProps {
  post: PostData;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
}

const MAX_PREVIEW_LENGTH = 300;

// ─── Image display ────────────────────────────────────────────────────────────

const CONTENT_MAX_WIDTH = 800;

function PostImages({ images }: { images: PostImageData[] }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  if (images.length === 0) return null;

  const sliderImages = images.map((img) => ({ url: img.url, alt: "Post image" }));

  return (
    <>
      <Box
        sx={{ mt: 1.5, maxWidth: CONTENT_MAX_WIDTH, mx: "auto" }}
        onClick={(e) => {
          // Open lightbox on click if not interacting with slider controls
          const target = e.target as HTMLElement;
          if (target.closest("button")) return;
          const el = e.currentTarget.querySelector("[role='region']");
          if (!el) return;
          const idx = parseInt(el.getAttribute("data-index") || "0", 10) || 0;
          setLightboxIndex(idx);
        }}
      >
        <ImageSlider
          images={sliderImages}
          aspectRatio="1/1"
          rounded
          onSlideChange={() => {}}
        />
      </Box>

      {lightboxIndex !== null && (
        <Box
          role="dialog" aria-modal="true" aria-label="Image lightbox — press Escape to close" tabIndex={-1}
          onClick={() => setLightboxIndex(null)}
          onKeyDown={(e) => { if (e.key === "Escape") setLightboxIndex(null); }}
          sx={{
            position: "fixed", inset: 0, bgcolor: "rgba(0,0,0,0.92)", zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "zoom-out",
          }}
        >
          <Box sx={{ width: "90vw", maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
            <ImageSlider images={sliderImages} aspectRatio="1/1" rounded={false} />
          </Box>
        </Box>
      )}
    </>
  );
}

// ─── Inline comment section ───────────────────────────────────────────────────

interface CommentRow {
  id: string;
  content: string;
  userId: string;
  userName: string | null;
  createdAt: string;
}

function InlineComments({ postId, currentUserId, onCountChange }: {
  postId: string;
  currentUserId?: string;
  onCountChange: (delta: number) => void;
}) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryKey = ["post-comments", postId];
  const isDark = theme.palette.mode === "dark";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const url = `/api/posts/${postId}/comments${pageParam ? `?cursor=${pageParam}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ data: CommentRow[]; nextCursor: string | null }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const allComments = data?.pages.flatMap((p) => p.data) ?? [];

  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || "Failed"); }
      return res.json() as Promise<{ data: CommentRow }>;
    },
    onSuccess: ({ data: newComment }) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const pages = [...old.pages];
        pages[0] = { ...pages[0], data: [newComment, ...pages[0].data] };
        return { ...old, pages };
      });
      onCountChange(1);
      setDraft("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/posts/${postId}/comments?commentId=${commentId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return commentId;
    },
    onSuccess: (commentId) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return { ...old, pages: old.pages.map((p: any) => ({ ...p, data: p.data.filter((c: CommentRow) => c.id !== commentId) })) };
      });
      onCountChange(-1);
    },
  });

  const handleSubmit = () => {
    const content = draft.trim();
    if (!content || postMutation.isPending) return;
    postMutation.mutate(content);
  };

  return (
    <Box sx={{ mt: 0 }}>
      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", mb: allComments.length > 0 ? 2 : 0 }}>
        <Box
          sx={{
            flex: 1, display: "flex", alignItems: "flex-end",
            backgroundColor: inputBg, borderRadius: 3, border: "1px solid", borderColor: "divider",
            px: 1.5, py: 0.75,
            "&:focus-within": { borderColor: "primary.main", boxShadow: `0 0 0 2px ${theme.palette.primary.main}22` },
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
            placeholder="Add a comment…"
            maxLength={1000}
            rows={1}
            style={{
              flex: 1, border: "none", outline: "none", resize: "none",
              background: "transparent", fontFamily: "inherit", fontSize: "0.85rem",
              lineHeight: 1.5, color: theme.palette.text.primary, paddingTop: 4, paddingBottom: 4,
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
        </Box>
        <IconButton size="small" onClick={handleSubmit} disabled={!draft.trim() || postMutation.isPending}
          sx={{ color: draft.trim() ? "primary.main" : "text.disabled", mb: 0.25 }} aria-label="Post comment">
          {postMutation.isPending ? <CircularProgress size={18} /> : <Send sx={{ fontSize: 18 }} />}
        </IconButton>
      </Box>

      {postMutation.isError && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
          {(postMutation.error as Error).message}
        </Typography>
      )}

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={20} /></Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {allComments.map((c) => {
            const initials = (c.userName || "U").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
            const isOwn = c.userId === currentUserId;
            return (
              <Box key={c.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Avatar sx={{ width: 30, height: 30, fontSize: 11, fontWeight: 700, bgcolor: "primary.main", color: "#fff", flexShrink: 0, mt: 0.25 }}>
                  {initials}
                </Avatar>
                <Box sx={{ flex: 1, backgroundColor: inputBg, borderRadius: 2, px: 1.5, py: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={700} color="text.primary">{c.userName || "User"}</Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>
                      {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
                    </Typography>
                    {isOwn && (
                      <IconButton size="small" onClick={() => deleteMutation.mutate(c.id)} disabled={deleteMutation.isPending}
                        sx={{ ml: "auto", p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}>
                        <Delete sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ fontSize: "0.83rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {c.content}
                  </Typography>
                </Box>
              </Box>
            );
          })}
          {hasNextPage && (
            <Button size="small" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
              sx={{ alignSelf: "center", textTransform: "none", fontSize: "0.8rem" }}>
              {isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── Engagement bar ───────────────────────────────────────────────────────────

function EngagementBar({ post, currentUserId, onCommentToggle, commentCount }: {
  post: PostData;
  currentUserId?: string;
  onCommentToggle: () => void;
  commentCount: number;
}) {
  const theme = useTheme();
  const [liked, setLiked] = useState(post.isLiked ?? false);
  const [likeCount, setLikeCount] = useState(post.likeCount ?? 0);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [saveCount, setSaveCount] = useState(post.saveCount ?? 0);
  const [likePending, setLikePending] = useState(false);
  const [savePending, setSavePending] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const handleLike = async () => {
    if (likePending || !currentUserId) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((n) => wasLiked ? Math.max(0, n - 1) : n + 1);
    setLikePending(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const json = await res.json();
      if (json.data) { setLiked(json.data.liked); setLikeCount(json.data.likeCount); }
    } catch {
      setLiked(wasLiked);
      setLikeCount((n) => wasLiked ? n + 1 : Math.max(0, n - 1));
    } finally {
      setLikePending(false);
    }
  };

  const handleSave = async () => {
    if (savePending || !currentUserId) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    setSaveCount((n) => wasSaved ? Math.max(0, n - 1) : n + 1);
    setSavePending(true);
    try {
      const res = await fetch(`/api/posts/${post.id}/save`, { method: "POST" });
      const json = await res.json();
      if (json.data) { setSaved(json.data.saved); setSaveCount(json.data.saveCount); }
    } catch {
      setSaved(wasSaved);
      setSaveCount((n) => wasSaved ? n + 1 : Math.max(0, n - 1));
    } finally {
      setSavePending(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/news`;
    if (navigator.share) {
      try { await navigator.share({ title: "Opletics News", url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const iconSx = { fontSize: 20 };
  const countSx = { fontSize: "0.78rem", fontWeight: 600, color: "text.secondary", minWidth: 16, lineHeight: 1 };

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1.5, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
      <Tooltip title={!currentUserId ? "Sign in to like" : liked ? "Unlike" : "Like"} placement="top">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <IconButton size="small" onClick={handleLike}
            sx={{ color: liked ? "error.main" : "text.secondary", transition: "color 0.15s, transform 0.1s", "&:active": { transform: "scale(0.88)" }, p: 0.75 }}>
            {liked ? <Favorite sx={iconSx} /> : <FavoriteBorder sx={iconSx} />}
          </IconButton>
          {likeCount > 0 && <Typography sx={countSx}>{likeCount}</Typography>}
        </Box>
      </Tooltip>

      <Tooltip title="Comment" placement="top">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          <IconButton size="small" onClick={onCommentToggle} sx={{ color: "text.secondary", p: 0.75 }}>
            <ChatBubbleOutline sx={iconSx} />
          </IconButton>
          {commentCount > 0 && <Typography sx={countSx}>{commentCount}</Typography>}
        </Box>
      </Tooltip>

      <Tooltip title={shareCopied ? "Link copied!" : "Share"} placement="top">
        <IconButton size="small" onClick={handleShare}
          sx={{ color: shareCopied ? "success.main" : "text.secondary", p: 0.75 }}>
          <Share sx={iconSx} />
        </IconButton>
      </Tooltip>

      <Box sx={{ flexGrow: 1 }} />

      <Tooltip title={!currentUserId ? "Sign in to save" : saved ? "Unsave" : "Save"} placement="top">
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
          {saveCount > 0 && <Typography sx={countSx}>{saveCount}</Typography>}
          <IconButton size="small" onClick={handleSave}
            sx={{ color: saved ? "primary.main" : "text.secondary", transition: "color 0.15s", p: 0.75 }}>
            {saved ? <Bookmark sx={iconSx} /> : <BookmarkBorder sx={iconSx} />}
          </IconButton>
        </Box>
      </Tooltip>
    </Box>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function PostCard({ post, currentUserId, onDelete }: PostCardProps) {
  const theme = useTheme();
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount ?? 0);

  const isOwn = currentUserId === post.author.id;
  const content = post.content || "";
  const isLong = content.length > MAX_PREVIEW_LENGTH;
  const displayContent = isLong && !expanded ? content.slice(0, MAX_PREVIEW_LENGTH) + "…" : content;
  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true });
  const initials = (post.author.name || "AD").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Card
      sx={{
        mb: 2, borderRadius: 3,
        boxShadow: theme.palette.mode === "dark" ? "0 1px 3px rgba(0,0,0,0.4)" : "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid", borderColor: "divider", transition: "box-shadow 0.15s",
        "&:hover": { boxShadow: theme.palette.mode === "dark" ? "0 4px 12px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.12)" },
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5 }}>
          <Avatar src={post.author.image || undefined}
            sx={{ width: 44, height: 44, bgcolor: "#1e293b", color: "#ffffff", fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
            {initials}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>{post.author.name || "Athletic Director"}</Typography>
            {post.author.schoolName && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <School sx={{ fontSize: 13, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary" noWrap>{post.author.schoolName}</Typography>
              </Box>
            )}
            <Typography variant="caption" color="text.disabled">{timeAgo}</Typography>
          </Box>
          <Chip label="Athletic Director" size="small" sx={{ fontSize: 11, height: 22, display: { xs: "none", sm: "flex" } }} />
          {isOwn && onDelete && (
            <>
              <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}><MoreHoriz fontSize="small" /></IconButton>
              <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}
                transformOrigin={{ horizontal: "right", vertical: "top" }} anchorOrigin={{ horizontal: "right", vertical: "bottom" }}>
                <MenuItem onClick={() => { setMenuAnchor(null); onDelete(post.id); }} sx={{ color: "error.main", gap: 1 }}>
                  <Delete fontSize="small" /> Delete post
                </MenuItem>
              </Menu>
            </>
          )}
        </Box>

        {/* Content — constrained to the same 800px column as the image so
            the text's left edge aligns with the image's left edge on wide
            screens. */}
        {content && (
          <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: "auto" }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6, fontSize: "0.9rem" }}>
              {displayContent}
            </Typography>
            {isLong && (
              <Typography component="span" variant="body2" onClick={() => setExpanded((v) => !v)}
                sx={{ color: "primary.main", cursor: "pointer", fontWeight: 600, ml: 0.5, "&:hover": { textDecoration: "underline" } }}>
                {expanded ? "see less" : "see more"}
              </Typography>
            )}
          </Box>
        )}

        <PostImages images={post.images} />

        <EngagementBar
          post={post}
          currentUserId={currentUserId}
          onCommentToggle={() => setCommentsOpen((v) => !v)}
          commentCount={commentCount}
        />

        <Collapse in={commentsOpen} timeout="auto" unmountOnExit>
          <Box sx={{ mt: 2 }}>
            <InlineComments
              postId={post.id}
              currentUserId={currentUserId}
              onCountChange={(delta) => setCommentCount((c) => Math.max(0, c + delta))}
            />
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  );
}
