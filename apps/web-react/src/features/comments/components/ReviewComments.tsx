import { useEffect, useMemo, useState } from "react"
import {
  createComment,
  deleteComment,
  getComments,
  likeComment,
  reportComment,
  unlikeComment,
  updateComment,
} from "../api"
import type { PublicComment } from "../types"
import "./review-comments.css"

type ReviewCommentsProps = {
  reviewId: string
  isAuthenticated: boolean
  currentUserId?: string
}

function formatCommentTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function updateCommentTree(
  comments: PublicComment[],
  commentId: string,
  updater: (comment: PublicComment) => PublicComment,
): PublicComment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return updater(comment)
    }

    return {
      ...comment,
      replies: updateCommentTree(comment.replies, commentId, updater),
    }
  })
}

export default function ReviewComments({
  reviewId,
  isAuthenticated,
  currentUserId,
}: ReviewCommentsProps) {
  const [comments, setComments] = useState<PublicComment[]>([])
  const [draftContent, setDraftContent] = useState("")
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyContent, setReplyContent] = useState("")
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const commentCountLabel = useMemo(
    () => (comments.length === 0 ? "No comments" : `${comments.length} threads`),
    [comments.length],
  )

  useEffect(() => {
    let isMounted = true

    async function loadComments() {
      try {
        setError("")
        setIsLoading(true)
        const response = await getComments(reviewId, "oldest")

        if (isMounted) {
          setComments(response.items)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load comments.")
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadComments()

    return () => {
      isMounted = false
    }
  }, [reviewId])

  async function handleCreateComment() {
    await submitComment(draftContent, undefined, (comment) => {
      setComments((currentComments) => [...currentComments, comment])
      setDraftContent("")
    })
  }

  async function handleCreateReply(parentId: string) {
    await submitComment(replyContent, parentId, (reply) => {
      setComments((currentComments) =>
        updateCommentTree(currentComments, parentId, (comment) => ({
          ...comment,
          replyCount: comment.replyCount + 1,
          replies: [...comment.replies, reply],
        })),
      )
      setReplyingToId(null)
      setReplyContent("")
    })
  }

  async function submitComment(
    rawContent: string,
    parentId: string | undefined,
    onSuccess: (comment: PublicComment) => void,
  ) {
    if (!isAuthenticated) {
      setError("Sign in to write a comment.")
      return
    }

    const content = rawContent.trim()
    if (!content) {
      setError("Enter a comment.")
      return
    }

    try {
      setError("")
      setIsSubmitting(true)
      const comment = await createComment(reviewId, content, parentId)
      onSuccess(comment)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create comment.")
    } finally {
      setIsSubmitting(false)
    }
  }

  function startEditing(comment: PublicComment) {
    setEditingCommentId(comment.id)
    setEditingContent(comment.content)
    setError("")
  }

  async function handleUpdateComment(commentId: string) {
    if (!isAuthenticated) {
      setError("Sign in to edit a comment.")
      return
    }

    const content = editingContent.trim()
    if (!content) {
      setError("Enter a comment.")
      return
    }

    try {
      setError("")
      const updatedComment = await updateComment(commentId, content)

      setComments((currentComments) =>
        updateCommentTree(currentComments, commentId, () => updatedComment),
      )
      setEditingCommentId(null)
      setEditingContent("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update comment.")
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!isAuthenticated) {
      setError("Sign in to delete a comment.")
      return
    }

    if (!window.confirm("Delete this comment?")) {
      return
    }

    try {
      setError("")
      await deleteComment(commentId)
      setComments((currentComments) =>
        currentComments
          .filter((comment) => comment.id !== commentId)
          .map((comment) => ({
            ...comment,
            replies: comment.replies.filter((reply) => reply.id !== commentId),
            replyCount:
              comment.replies.some((reply) => reply.id === commentId)
                ? Math.max(0, comment.replyCount - 1)
                : comment.replyCount,
          })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete comment.")
    }
  }

  async function handleToggleLike(comment: PublicComment) {
    if (!isAuthenticated) {
      setError("Sign in to like a comment.")
      return
    }

    try {
      setError("")
      if (comment.likedByMe) {
        await unlikeComment(comment.id)
      } else {
        await likeComment(comment.id)
      }

      setComments((currentComments) =>
        updateCommentTree(currentComments, comment.id, (currentComment) => ({
          ...currentComment,
          likedByMe: !currentComment.likedByMe,
          likeCount: currentComment.likedByMe
            ? Math.max(0, currentComment.likeCount - 1)
            : currentComment.likeCount + 1,
        })),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update like.")
    }
  }

  async function handleReportComment(comment: PublicComment) {
    if (!isAuthenticated) {
      setError("Sign in to report a comment.")
      return
    }

    const reason = window.prompt("Report reason")
    if (!reason?.trim()) {
      return
    }

    try {
      setError("")
      await reportComment(comment.id, reason.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to report comment.")
    }
  }

  function renderComment(comment: PublicComment, isReply = false) {
    const canManage = comment.author.id === currentUserId
    const isEditing = editingCommentId === comment.id

    return (
      <article className="review-comment-item" key={comment.id} data-reply={isReply || undefined}>
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
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCommentId(null)
                  setEditingContent("")
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p>{comment.content}</p>
        )}

        {comment.mentions.length > 0 ? (
          <div className="review-comment-mentions">
            {comment.mentions.map((mention) => (
              <span key={mention}>@{mention}</span>
            ))}
          </div>
        ) : null}

        <div className="review-comment-actions">
          <button type="button" onClick={() => handleToggleLike(comment)} disabled={!isAuthenticated}>
            {comment.likedByMe ? "Liked" : "Like"} {comment.likeCount}
          </button>
          {!isReply ? (
            <button
              type="button"
              onClick={() => {
                setReplyingToId(comment.id)
                setReplyContent("")
              }}
              disabled={!isAuthenticated}
            >
              Reply {comment.replyCount}
            </button>
          ) : null}
          <button type="button" onClick={() => handleReportComment(comment)} disabled={!isAuthenticated}>
            Report
          </button>
          {canManage && !isEditing ? (
            <>
              <button type="button" onClick={() => startEditing(comment)}>
                Edit
              </button>
              <button type="button" onClick={() => handleDeleteComment(comment.id)}>
                Delete
              </button>
            </>
          ) : null}
        </div>

        {!isReply && replyingToId === comment.id ? (
          <div className="review-comment-reply-form">
            <textarea
              value={replyContent}
              onChange={(event) => setReplyContent(event.target.value)}
              placeholder="Write a reply."
              rows={2}
            />
            <div>
              <button
                type="button"
                onClick={() => handleCreateReply(comment.id)}
                disabled={!replyContent.trim() || isSubmitting}
              >
                Post reply
              </button>
              <button
                type="button"
                onClick={() => {
                  setReplyingToId(null)
                  setReplyContent("")
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {!isReply && comment.replies.length > 0 ? (
          <div className="review-comment-replies">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        ) : null}
      </article>
    )
  }

  return (
    <section className="review-comments" aria-labelledby="review-comments-title">
      <header className="review-comments-header">
        <div>
          <p>{commentCountLabel}</p>
          <h3 id="review-comments-title">Comments</h3>
        </div>
      </header>

      <div className="review-comment-form">
        <textarea
          value={draftContent}
          onChange={(event) => setDraftContent(event.target.value)}
          placeholder={
            isAuthenticated
              ? "Ask a question or add context about this seat."
              : "Sign in to write a comment."
          }
          disabled={!isAuthenticated || isSubmitting}
          rows={3}
        />
        <div>
          <span>{draftContent.trim().length} chars</span>
          <button type="button" onClick={handleCreateComment} disabled={!isAuthenticated || isSubmitting}>
            {isSubmitting ? "Posting..." : "Post comment"}
          </button>
        </div>
      </div>

      {error ? <p className="review-comments-state review-comments-state--error">{error}</p> : null}
      {isLoading ? <p className="review-comments-state">Loading comments...</p> : null}

      {!isLoading ? (
        comments.length > 0 ? (
          <div className="review-comment-list">{comments.map((comment) => renderComment(comment))}</div>
        ) : (
          <p className="review-comments-state">No comments yet.</p>
        )
      ) : null}
    </section>
  )
}
