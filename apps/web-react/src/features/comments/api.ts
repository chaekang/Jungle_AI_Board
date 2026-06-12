import { apiRequest } from "../../shared/api";
import { buildCommentListPath, type CommentSort } from "./comment-api-paths";
import type { CommentListResponse, PublicComment } from "./types";

export function getComments(reviewId: string, sort: CommentSort = "oldest") {
  return apiRequest<CommentListResponse>(buildCommentListPath(reviewId, sort));
}

export function createComment(reviewId: string, content: string, token: string) {
  return apiRequest<PublicComment>(
    `/seat-reviews/${reviewId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ content }),
    },
    token,
  );
}

export function updateComment(commentId: string, content: string, token: string) {
  return apiRequest<PublicComment>(
    `/comments/${commentId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ content }),
    },
    token,
  );
}

export function deleteComment(commentId: string, token: string) {
  return apiRequest<{ deleted: boolean }>(
    `/comments/${commentId}`,
    {
      method: "DELETE",
    },
    token,
  );
}
