import assert from "node:assert/strict"
import test from "node:test"
import {
  addComparisonSeat,
  buildComparisonCandidates,
  buildComparisonQuestion,
  buildSeatEvidenceSummary,
  getComparisonSeatKey,
  toggleComparisonSeat,
} from "./seat-comparison.ts"
import type { PublicSeatReview } from "../reviews/types.ts"

function makeReview(id: string, overrides: Partial<PublicSeatReview> = {}): PublicSeatReview {
  return {
    id,
    author: { id: "1", nickname: "관객" },
    theater: { id: "10", name: "세종문화회관 대극장" },
    musical: { id: "20", title: "웃는 남자" },
    performance: { id: "30", seasonLabel: "2026" },
    seat: { floor: "1층", section: "B", row: "8", number: "12" },
    ratings: { view: 5, sound: 4, comfort: 3, expression: 5, stageVisibility: 4 },
    content: "표정은 잘 보였고 무대 전체도 편하게 봤어요.",
    tags: [{ id: "1", name: "표정잘보임", type: "seat_feature" }],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  }
}

test("comparison seat identity is stable across reviews for the same performance and seat", () => {
  assert.equal(getComparisonSeatKey(makeReview("1")), getComparisonSeatKey(makeReview("2")))
})

test("comparison box deduplicates seats and refuses a fourth seat", () => {
  const first = makeReview("1")
  const second = makeReview("2", { seat: { floor: "1층", section: "B", row: "8", number: "13" } })
  const third = makeReview("3", { seat: { floor: "1층", section: "B", row: "8", number: "14" } })
  const fourth = makeReview("4", { seat: { floor: "1층", section: "B", row: "8", number: "15" } })

  assert.deepEqual(addComparisonSeat([first], first), { seats: [first], message: "" })
  assert.equal(addComparisonSeat([first, second, third], fourth).seats.length, 3)
  assert.match(addComparisonSeat([first, second, third], fourth).message, /최대 3개/)
})

test("comparison seat toggle removes an existing seat using the shared identity rule", () => {
  const first = makeReview("1")
  const sameSeat = makeReview("2")

  assert.deepEqual(toggleComparisonSeat([first], sameSeat), { seats: [], message: "" })
})

test("comparison accepts different performances in the same theater only", () => {
  const first = makeReview("1")
  const differentPerformance = makeReview("2", {
    musical: { id: "21", title: "팬텀" },
    performance: { id: "31", seasonLabel: "2025" },
    seat: { floor: "2층", section: "C", row: "3", number: "10" },
  })
  const differentTheater = makeReview("3", {
    theater: { id: "11", name: "블루스퀘어 신한카드홀" },
  })

  assert.deepEqual(addComparisonSeat([first], differentPerformance), {
    seats: [first, differentPerformance],
    message: "",
  })
  assert.deepEqual(addComparisonSeat([first], differentTheater), {
    seats: [first],
    message: "같은 극장의 좌석끼리 비교할 수 있어요.",
  })
})
test("evidence summary keeps sample size prominent and separates positive and caution reviews", () => {
  const positive = makeReview("1")
  const caution = makeReview("2", {
    ratings: { view: 2, sound: 3, comfort: 2, expression: 3, stageVisibility: 2 },
    content: "난간 때문에 무대 하단이 가렸고 좌석도 불편했어요.",
    tags: [{ id: "2", name: "시야방해", type: "seat_feature" }],
  })
  const summary = buildSeatEvidenceSummary({ seat: positive, directReviews: [positive, caution], nearbyReviews: [], sectionReviews: [], totalDirectReviews: 2 })

  assert.equal(summary.reviewCount, 2)
  assert.equal(summary.evidenceLevel, "direct")
  assert.equal(summary.sampleWarning, "후기 2개로 아직 표본이 적어요.")
  assert.equal(summary.positiveReview?.id, "1")
  assert.equal(summary.cautionReview?.id, "2")
  assert.equal(summary.averageRatings.view, 3.5)
  assert.deepEqual(summary.frequentTags, ["표정잘보임", "시야방해"])
})

test("evidence summary labels nearby, section fallback, and no-evidence states without inventing facts", () => {
  const seat = makeReview("1")
  const nearby = makeReview("2", { seat: { floor: "1층", section: "B", row: "8", number: "13" } })
  const section = makeReview("3", { seat: { floor: "1층", section: "B", row: "10", number: "20" } })

  assert.equal(buildSeatEvidenceSummary({ seat, directReviews: [], nearbyReviews: [nearby], sectionReviews: [], totalDirectReviews: 0 }).evidenceLevel, "nearby")
  assert.equal(buildSeatEvidenceSummary({ seat, directReviews: [], nearbyReviews: [], sectionReviews: [section], totalDirectReviews: 0 }).evidenceLevel, "section")
  const none = buildSeatEvidenceSummary({ seat, directReviews: [], nearbyReviews: [], sectionReviews: [], totalDirectReviews: 0 })
  assert.equal(none.evidenceLevel, "none")
  assert.equal(none.positiveReview, null)
  assert.equal(none.cautionReview, null)
})

test("structured candidates preserve multi-letter and missing sections without text parsing", () => {
  const opSeat = makeReview("1", {
    seat: { floor: "1층", section: "OP", row: "1", number: "8" },
  })
  const sectionlessSeat = makeReview("2", {
    seat: { floor: "2층", section: null, row: "5", number: "9" },
  })

  assert.deepEqual(buildComparisonCandidates([opSeat, sectionlessSeat]), [
    {
      floor: "1층",
      section: "OP",
      row: "1",
      seatNumber: "8",
      musicalTitle: "웃는 남자",
      seasonLabel: "2026",
    },
    {
      floor: "2층",
      section: null,
      row: "5",
      seatNumber: "9",
      musicalTitle: "웃는 남자",
      seasonLabel: "2026",
    },
  ])
})
test("comparison question includes exact seat numbers and explicitly disables generic recommendation framing", () => {
  const first = makeReview("1")
  const second = makeReview("2", { seat: { floor: "1층", section: "B", row: "8", number: "13" } })
  const question = buildComparisonQuestion([first, second], ["view", "sound"])

  assert.match(question, /1층 B구역 8열 12번/)
  assert.match(question, /1층 B구역 8열 13번/)
  assert.match(question, /실제 후기만/)
  assert.match(question, /시야/)
  assert.match(question, /음향/)
})
