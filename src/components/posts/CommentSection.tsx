"use client";

import { useState, useRef } from "react";
import {
  Avatar,
  Box,
  CircularProgress,
  IconButton,
  Typography,
  Button,
} from "@mui/material";
import { Send, Delete } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface PostComment {
  id: string;
  content: string;
  parentId: string;
  parentName: string | null;
  createdAt: string;
}

interface CommentSectionProps {
  postId: string;
  currentParentId: string;
  onCountChange: (delta: number) => void;
}

const PAGE_SIZE = 20;

export default function CommentSection({ postId, currentParentId, onCountChange }: CommentSectionProps) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const queryKey = ["post-comments", postId];

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }: { pageParam: string | null }) => {
      const url = `/api/parent/posts/${postId}/comments${pageParam ? `?cursor=${pageParam}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load comments");
      return res.json() as Promise<{ data: PostComment[]; nextCursor: string | null }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });

  const allComments = data?.pages.flatMap((p) => p.data) ?? [];

  const postMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/parent/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || "Failed to post comment");
      }
      return res.json() as Promise<{ data: PostComment }>;
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
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const res = await fetch(`/api/parent/posts/${postId}/comments?commentId=${commentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      return commentId;
    },
    onSuccess: (commentId) => {
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.filter((c: PostComment) => c.id !== commentId),
          })),
        };
      });
      onCountChange(-1);
    },
  });

  const handleSubmit = () => {
    const content = draft.trim();
    if (!content || postMutation.isPending) return;
    postMutation.mutate(content);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isDark = theme.palette.mode === "dark";
  const inputBg = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)";

  return (
    <Box sx={{ mt: 0 }}>
      {/* Comment input */}
      <Box
        sx={{
          display: "flex",
          gap: 1,
          alignItems: "flex-end",
          mb: allComments.length > 0 ? 2 : 0,
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: "flex",
            alignItems: "flex-end",
            backgroundColor: inputBg,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            px: 1.5,
            py: 0.75,
            "&:focus-within": {
              borderColor: "primary.main",
              boxShadow: `0 0 0 2px ${theme.palette.primary.main}22`,
            },
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        >
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a comment…"
            maxLength={1000}
            rows={1}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              resize: "none",
              background: "transparent",
              fontFamily: "inherit",
              fontSize: "0.85rem",
              lineHeight: 1.5,
              color: theme.palette.text.primary,
              paddingTop: 4,
              paddingBottom: 4,
            }}
            onInput={(e) => {
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
          />
        </Box>
        <IconButton
          size="small"
          onClick={handleSubmit}
          disabled={!draft.trim() || postMutation.isPending}
          sx={{
            color: draft.trim() ? "primary.main" : "text.disabled",
            transition: "color 0.15s",
            mb: 0.25,
          }}
          aria-label="Post comment"
        >
          {postMutation.isPending ? (
            <CircularProgress size={18} />
          ) : (
            <Send sx={{ fontSize: 18 }} />
          )}
        </IconButton>
      </Box>

      {postMutation.isError && (
        <Typography variant="caption" color="error" sx={{ mb: 1, display: "block" }}>
          {(postMutation.error as Error).message}
        </Typography>
      )}

      {/* Comments list */}
      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {allComments.map((comment) => {
            const initials = (comment.parentName || "P")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const isOwn = comment.parentId === currentParentId;
            return (
              <Box key={comment.id} sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Avatar
                  sx={{
                    width: 30,
                    height: 30,
                    fontSize: 11,
                    fontWeight: 700,
                    bgcolor: "primary.main",
                    color: "#fff",
                    flexShrink: 0,
                    mt: 0.25,
                  }}
                >
                  {initials}
                </Avatar>
                <Box
                  sx={{
                    flex: 1,
                    backgroundColor: inputBg,
                    borderRadius: 2,
                    px: 1.5,
                    py: 1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
                    <Typography variant="caption" fontWeight={700} color="text.primary">
                      {comment.parentName || "Parent"}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.7rem" }}>
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </Typography>
                    {isOwn && (
                      <IconButton
                        size="small"
                        onClick={() => deleteMutation.mutate(comment.id)}
                        disabled={deleteMutation.isPending}
                        sx={{ ml: "auto", p: 0.25, color: "text.disabled", "&:hover": { color: "error.main" } }}
                        aria-label="Delete comment"
                      >
                        <Delete sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: "0.83rem", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                  >
                    {comment.content}
                  </Typography>
                </Box>
              </Box>
            );
          })}

          {hasNextPage && (
            <Button
              size="small"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              sx={{ alignSelf: "center", textTransform: "none", fontSize: "0.8rem" }}
            >
              {isFetchingNextPage ? "Loading…" : "Load more comments"}
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
