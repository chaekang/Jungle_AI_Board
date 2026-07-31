import type { PublicSeatReview } from "../reviews/types"
import type { SeatRecommendation, SeatRecommendationInput } from "./types"

export const SEAT_ASSISTANT_WELCOME =
  "궁금한 좌석을 편하게 물어보세요. 극장명, 층, 구역과 궁금한 점을 한 문장으로 적으면 후기를 확인하고 답할게요."

export function getAssistantReply(result: SeatRecommendation) {
  return result.recommendation.trim()
}

export function buildSeatAssistantRequest(
  question: string,
  seats: PublicSeatReview[],
): SeatRecommendationInput {
  const firstSeat = seats[0]

  return {
    question: question.trim(),
    theaterName: firstSeat?.theater.name,
    musicalTitle: firstSeat?.musical.title,
    seasonLabel: firstSeat?.performance?.seasonLabel ?? undefined,
    candidates: seats.length >= 2
      ? seats.map((seat) => ({
          floor: seat.seat.floor,
          section: seat.seat.section,
          row: seat.seat.row,
          seatNumber: seat.seat.number,
        }))
      : undefined,
    limit: seats.length >= 2 ? 10 : 5,
    useRag: true,
  }
}
