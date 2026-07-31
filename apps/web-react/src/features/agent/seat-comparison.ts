import type { AgentPriority, AgentSeatCandidateInput } from "./types"
import type { PublicSeatReview } from "../reviews/types"

export const comparisonLimit = 3

export type EvidenceLevel = "direct" | "nearby" | "section" | "none"

export type RatingAverages = PublicSeatReview["ratings"]

export type SeatEvidenceSummary = {
  seat: PublicSeatReview
  reviewCount: number
  evidenceLevel: EvidenceLevel
  evidenceLabel: string
  sampleWarning: string
  averageRatings: RatingAverages
  frequentTags: string[]
  positiveReview: PublicSeatReview | null
  cautionReview: PublicSeatReview | null
  fallbackReviews: PublicSeatReview[]
}

const evidenceLabels: Record<EvidenceLevel, string> = {
  direct: "동일 좌석 후기",
  nearby: "인접 좌석 참고",
  section: "같은 구역 후기 참고",
  none: "아직 판단할 후기가 부족함",
}

const priorityLabels: Record<AgentPriority, string> = {
  view: "시야",
  sound: "음향",
  comfort: "편안함",
  expression: "표정",
  stageVisibility: "무대 가시성",
  lowObstruction: "시야 방해 적음",
}

const cautionWords = [
  "시야방해",
  "가림",
  "불편",
  "답답",
  "난간",
  "사이드",
  "주의",
  "아쉬",
]

function normalizeSeatPart(value?: string | null) {
  return value?.trim().replace(/\s+/g, " ").toUpperCase() ?? ""
}

export function getComparisonSeatKey(review: PublicSeatReview) {
  return [
    review.theater.id,
    review.performance?.id ?? review.musical.id,
    normalizeSeatPart(review.seat.floor),
    normalizeSeatPart(review.seat.section),
    normalizeSeatPart(review.seat.row),
    normalizeSeatPart(review.seat.number),
  ].join(":")
}

export function getSeatLabel(review: PublicSeatReview) {
  return [
    review.seat.floor,
    review.seat.section ? `${review.seat.section}구역` : "",
    review.seat.row ? `${review.seat.row}열` : "",
    review.seat.number ? `${review.seat.number}번` : "",
  ]
    .filter(Boolean)
    .join(" ")
}

export function hasComparisonSeat(seats: PublicSeatReview[], review: PublicSeatReview) {
  const reviewKey = getComparisonSeatKey(review)
  return seats.some((seat) => getComparisonSeatKey(seat) === reviewKey)
}

export function addComparisonSeat(
  currentSeats: PublicSeatReview[],
  nextSeat: PublicSeatReview,
): { seats: PublicSeatReview[]; message: string } {
  if (hasComparisonSeat(currentSeats, nextSeat)) {
    return { seats: currentSeats, message: "" }
  }

  const firstSeat = currentSeats[0]
  if (firstSeat && firstSeat.theater.id !== nextSeat.theater.id) {
    return {
      seats: currentSeats,
      message: "같은 극장의 좌석끼리 비교할 수 있어요.",
    }
  }

  if (currentSeats.length >= comparisonLimit) {
    return {
      seats: currentSeats,
      message: `비교함에는 최대 ${comparisonLimit}개 좌석을 담을 수 있어요.`,
    }
  }

  return { seats: [...currentSeats, nextSeat], message: "" }
}

export function toggleComparisonSeat(
  currentSeats: PublicSeatReview[],
  seat: PublicSeatReview,
): { seats: PublicSeatReview[]; message: string } {
  if (hasComparisonSeat(currentSeats, seat)) {
    const seatKey = getComparisonSeatKey(seat)
    return {
      seats: currentSeats.filter((currentSeat) => getComparisonSeatKey(currentSeat) !== seatKey),
      message: "",
    }
  }

  return addComparisonSeat(currentSeats, seat)
}

function averageReviewRating(review: PublicSeatReview) {
  const values = Object.values(review.ratings)
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundRating(value: number) {
  return Math.round(value * 10) / 10
}

function averageRatings(reviews: PublicSeatReview[]): RatingAverages {
  const empty: RatingAverages = {
    view: 0,
    sound: 0,
    comfort: 0,
    expression: 0,
    stageVisibility: 0,
  }

  if (reviews.length === 0) {
    return empty
  }

  return Object.fromEntries(
    Object.keys(empty).map((key) => [
      key,
      roundRating(
        reviews.reduce(
          (sum, review) => sum + review.ratings[key as keyof RatingAverages],
          0,
        ) / reviews.length,
      ),
    ]),
  ) as RatingAverages
}

function getFrequentTags(reviews: PublicSeatReview[]) {
  const counts = new Map<string, { count: number; order: number }>()
  let order = 0

  reviews.forEach((review) => {
    review.tags?.forEach((tag) => {
      const current = counts.get(tag.name)
      counts.set(tag.name, {
        count: (current?.count ?? 0) + 1,
        order: current?.order ?? order++,
      })
    })
  })

  return [...counts.entries()]
    .sort(([, left], [, right]) => right.count - left.count || left.order - right.order)
    .slice(0, 5)
    .map(([name]) => name)
}

function hasCautionSignal(review: PublicSeatReview) {
  const text = [review.content, ...(review.tags?.map((tag) => tag.name) ?? [])].join(" ")
  return cautionWords.some((word) => text.includes(word))
}

function resolveEvidenceSource(input: {
  directReviews: PublicSeatReview[]
  nearbyReviews: PublicSeatReview[]
  sectionReviews: PublicSeatReview[]
}): { level: EvidenceLevel; reviews: PublicSeatReview[] } {
  if (input.directReviews.length) {
    return { level: "direct", reviews: input.directReviews }
  }
  if (input.nearbyReviews.length) {
    return { level: "nearby", reviews: input.nearbyReviews }
  }
  if (input.sectionReviews.length) {
    return { level: "section", reviews: input.sectionReviews }
  }
  return { level: "none", reviews: [] }
}

export function buildSeatEvidenceSummary(input: {
  seat: PublicSeatReview
  directReviews: PublicSeatReview[]
  nearbyReviews: PublicSeatReview[]
  sectionReviews: PublicSeatReview[]
  totalDirectReviews: number
}): SeatEvidenceSummary {
  const { level: evidenceLevel, reviews: sourceReviews } = resolveEvidenceSource(input)
  const sortedReviews = [...sourceReviews].sort(
    (left, right) => averageReviewRating(right) - averageReviewRating(left),
  )
  const positiveReview = sortedReviews[0] ?? null
  const signaledCaution = sortedReviews.find(
    (review) => review.id !== positiveReview?.id && hasCautionSignal(review),
  )
  const lowestReview = sortedReviews.at(-1) ?? null
  const cautionReview =
    signaledCaution ??
    (lowestReview &&
    positiveReview &&
    lowestReview.id !== positiveReview.id &&
    averageReviewRating(positiveReview) - averageReviewRating(lowestReview) >= 0.5
      ? lowestReview
      : null)

  return {
    seat: input.seat,
    reviewCount: input.totalDirectReviews,
    evidenceLevel,
    evidenceLabel: evidenceLabels[evidenceLevel],
    sampleWarning:
      input.totalDirectReviews < 3
        ? input.totalDirectReviews > 0
          ? `후기 ${input.totalDirectReviews}개로 아직 표본이 적어요.`
          : "동일 좌석 후기가 없어 주변 후기를 구분해 보여드려요."
        : "",
    averageRatings: averageRatings(sourceReviews),
    frequentTags: getFrequentTags(sourceReviews),
    positiveReview,
    cautionReview,
    fallbackReviews: evidenceLevel === "direct" ? [] : sourceReviews,
  }
}

export function buildComparisonCandidates(
  seats: PublicSeatReview[],
): AgentSeatCandidateInput[] {
  return seats.map((seat) => ({
    floor: seat.seat.floor,
    section: seat.seat.section,
    row: seat.seat.row,
    seatNumber: seat.seat.number,
    musicalTitle: seat.musical.title,
    seasonLabel: seat.performance?.seasonLabel ?? undefined,
  }))
}

export function buildComparisonQuestion(
  seats: PublicSeatReview[],
  priorities: AgentPriority[],
) {
  const seatText = seats.map(getSeatLabel).join(", ")
  const priorityText = priorities.length
    ? priorities.map((priority) => priorityLabels[priority]).join("·")
    : "전체 관람 경험"

  return `${seatText} 중에서 ${priorityText} 기준으로 비교해줘. 실제 후기만 근거로 쓰고, 근거가 부족하면 좌석을 단정하지 말아줘.`
}
