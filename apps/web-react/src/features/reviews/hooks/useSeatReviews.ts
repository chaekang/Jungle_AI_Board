import { useEffect, useState } from "react"
import { getSeatReviews } from "../api"
import { loadAllSeatReviewPages } from "../review-pagination"
import type { PublicSeatReview } from "../types"

export function useSeatReviews() {
  const [reviews, setReviews] = useState<PublicSeatReview[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadReviews() {
      try {
        setError("")
        setIsLoading(true)

        const items = await loadAllSeatReviewPages(getSeatReviews)
        setReviews(items)
      } catch (err) {
        setError(err instanceof Error ? err.message : "후기 목록을 불러오지 못했습니다.")
      } finally {
        setIsLoading(false)
      }
    }

    void loadReviews()
  }, [])

  return {
    reviews,
    isLoading,
    error,
    removeReview(reviewId: string) {
      setReviews((currentReviews) => currentReviews.filter((review) => review.id !== reviewId))
    },
  }
}
