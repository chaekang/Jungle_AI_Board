import { useEffect, useMemo, useState } from "react";
import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from "../api";
import type { PublicComment } from "../types";
import "./review-comments.css";

type ReviewCommentsProps = {
  reviewId: string;
  authToken: string | null;
  currentUserId?: string;
};

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function ReviewComments({
  reviewId,
  authToken,
  currentUserId,
}: ReviewCommentsProps) {
  const [comments, setComments] = useState<PublicComment[]>([]);
  const [draftContent, setDraftContent] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const commentCountLabel = useMemo(() => {
    return comments.length === 0 ? "댓글 없음" : `댓글 ${comments.length}개`;
  }, [comments.length]);

  useEffect(() => {
    let isMounted = true;

    async function loadComments() {
      try {
        setError("");
        setIsLoading(true);

        const response = await getComments(reviewId, "oldest");

        if (isMounted) {
          setComments(response.items);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "댓글을 불러오지 못했습니다.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadComments();

    return () => {
      isMounted = false;
    };
  }, [reviewId]);

  async function handleCreateComment() {
    if (!authToken) {
      setError("로그인 후 댓글을 작성할 수 있습니다.");
      return;
    }

    const content = draftContent.trim();

    if (!content) {
      setError("댓글 내용을 입력해 주세요.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);

      const comment = await createComment(reviewId, content, authToken);
      setComments((currentComments) => [...currentComments, comment]);
      setDraftContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "댓글 작성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startEditing(comment: PublicComment) {
    setEditingCommentId(comment.id);
    setEditingContent(comment.content);
    setError("");
  }

  async function handleUpdateComment(commentId: string) {
    if (!authToken) {
      setError("로그인 후 댓글을 수정할 수 있습니다.");
      return;
    }

    const content = editingContent.trim();

    if (!content) {
      setError("댓글 내용을 입력해 주세요.");
      return;
    }

    try {
      setError("");

      const updatedComment = await updateComment(commentId, content, authToken);

      setComments((currentComments) =>
        currentComments.map((comment) =>
          comment.id === commentId ? updatedComment : comment,
        ),
      );
      setEditingCommentId(null);
      setEditingContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "댓글 수정에 실패했습니다.");
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!authToken) {
      setError("로그인 후 댓글을 삭제할 수 있습니다.");
      return;
    }

    if (!window.confirm("댓글을 삭제할까요?")) {
      return;
    }

    try {
      setError("");
      await deleteComment(commentId, authToken);

      setComments((currentComments) =>
        currentComments.filter((comment) => comment.id !== commentId),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "댓글 삭제에 실패했습니다.");
    }
  }

  return (
    <section className="review-comments" aria-labelledby="review-comments-title">
      <header className="review-comments-header">
        <div>
          <p>{commentCountLabel}</p>
          <h3 id="review-comments-title">댓글</h3>
        </div>
      </header>

      <div className="review-comment-form">
        <textarea
          value={draftContent}
          onChange={(event) => setDraftContent(event.target.value)}
          placeholder={
            authToken
              ? "이 좌석 후기에 대한 질문이나 보충 의견을 남겨보세요."
              : "로그인 후 댓글을 작성할 수 있습니다."
          }
          disabled={!authToken || isSubmitting}
          rows={3}
        />
        <div>
          <span>{draftContent.trim().length}자</span>
          <button
            type="button"
            onClick={handleCreateComment}
            disabled={!authToken || isSubmitting}
          >
            {isSubmitting ? "작성 중" : "댓글 작성"}
          </button>
        </div>
      </div>

      {error ? <p className="review-comments-state review-comments-state--error">{error}</p> : null}
      {isLoading ? <p className="review-comments-state">댓글을 불러오는 중입니다.</p> : null}

      {!isLoading ? (
        comments.length > 0 ? (
          <div className="review-comment-list">
            {comments.map((comment) => {
              const canManage = comment.author.id === currentUserId;
              const isEditing = editingCommentId === comment.id;

              return (
                <article className="review-comment-item" key={comment.id}>
                  <div className="review-comment-meta">
                    <strong>{comment.author.nickname}</strong>
                    <span>{formatCommentTime(comment.createdAt)}</span>
                  </div>

                  {isEditing ? (
                    <div className="review-comment-edit">
                      <textarea
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        rows={3}
                      />
                      <div>
                        <button type="button" onClick={() => handleUpdateComment(comment.id)}>
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCommentId(null);
                            setEditingContent("");
                          }}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p>{comment.content}</p>
                  )}

                  {canManage && !isEditing ? (
                    <div className="review-comment-actions">
                      <button type="button" onClick={() => startEditing(comment)}>
                        수정
                      </button>
                      <button type="button" onClick={() => handleDeleteComment(comment.id)}>
                        삭제
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="review-comments-state">아직 댓글이 없습니다.</p>
        )
      ) : null}
    </section>
  );
}
