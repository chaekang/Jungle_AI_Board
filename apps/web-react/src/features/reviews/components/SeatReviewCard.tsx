import type { PublicSeatReview } from "../types"

type SeatReviewCardProps = {
  review: PublicSeatReview
  onSelect?: (review: PublicSeatReview) => void
  onTheaterSelect?: (review: PublicSeatReview) => void
  onEdit?: (review: PublicSeatReview) => void
  onDelete?: (review: PublicSeatReview) => void
  onReport?: (review: PublicSeatReview) => void
  variant?: "default" | "detail"
  canManage?: boolean
}

const ratingText: Record<number, string> = {
  1: "Worst",
  2: "Weak",
  3: "Average",
  4: "Good",
  5: "Best",
}

function getRatingLabel(value: number) {
  return ratingText[value] ?? String(value)
}

function getPerformanceTitle(review: PublicSeatReview) {
  return [review.performance?.seasonLabel, review.musical.title].filter(Boolean).join(" ")
}

function getSeatLabel(review: PublicSeatReview) {
  return [
    review.seat.floor,
    review.seat.section ? `${review.seat.section} section` : "",
    review.seat.row ? `${review.seat.row} row` : "",
    review.seat.number ? `${review.seat.number} seat` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export default function SeatReviewCard({
  review,
  onSelect,
  onTheaterSelect,
  onEdit,
  onDelete,
  onReport,
  variant = "default",
  canManage = false,
}: SeatReviewCardProps) {
  const isInteractive = Boolean(onSelect)
  const tags = review.tags ?? []

  return (
    <article
      className={`board-review-card board-review-card--${variant}`}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={isInteractive ? () => onSelect?.(review) : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onSelect?.(review)
              }
            }
          : undefined
      }
    >
      <p className="board-review-content">{review.content}</p>

      <div className="board-review-meta">
        <h2>{getPerformanceTitle(review)}</h2>
        {onTheaterSelect ? (
          <button
            className="board-review-theater-link"
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onTheaterSelect(review)
            }}
          >
            {review.theater.name}
          </button>
        ) : (
          <p>{review.theater.name}</p>
        )}
        <p>{getSeatLabel(review)}</p>
        <p className="board-review-byline">
          {review.author.nickname} - {formatCreatedAt(review.createdAt)}
        </p>
      </div>

      <div className="board-rating-tags" aria-label="Ratings">
        <span>View {getRatingLabel(review.ratings.view)}</span>
        <span>Sound {getRatingLabel(review.ratings.sound)}</span>
        <span>Comfort {getRatingLabel(review.ratings.comfort)}</span>
        <span>Expression {getRatingLabel(review.ratings.expression)}</span>
        <span>Stage {getRatingLabel(review.ratings.stageVisibility)}</span>
      </div>

      {tags.length > 0 ? (
        <div className="board-review-tags" aria-label="Tags">
          {tags.map((tag) => (
            <span key={tag.id}>{tag.name}</span>
          ))}
        </div>
      ) : null}

      {canManage || onReport ? (
        <div className="board-review-actions">
          {onReport ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onReport(review)
              }}
            >
              Report
            </button>
          ) : null}
          {canManage ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onEdit?.(review)
                }}
              >
                Edit
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onDelete?.(review)
                }}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}
