import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import type { PublicSeatReview } from "../reviews/types.ts"
import {
  buildSeatAssistantRequest,
  getAssistantReply,
} from "./seat-assistant-presentation.ts"
import type { SeatRecommendation } from "./types.ts"

function makeReview(id: string, number: string): PublicSeatReview {
  return {
    id,
    author: { id: "1", nickname: "관객" },
    theater: { id: "10", name: "블루스퀘어 신한카드홀" },
    musical: { id: "20", title: "웃는 남자" },
    performance: { id: "30", seasonLabel: "2026" },
    seat: { floor: "3층", section: "B", row: "4", number },
    ratings: { view: 4, sound: 4, comfort: 3, expression: 2, stageVisibility: 5 },
    content: "전체 무대는 잘 보이고 표정은 오글이 필요해요.",
    tags: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  }
}

test("assistant reply exposes only the final recommendation", () => {
  const result = {
    recommendation: "전체 무대는 잘 보이고 표정을 보려면 오글이 필요해요.",
    direction: "neutral",
    reasons: ["관련 후기 3개"],
    cautions: ["사이드 시야"],
    evidenceReviews: [],
    filters: { priorities: [] },
    mcpStatus: "ok",
    ragStatus: "fallback",
  } as SeatRecommendation

  assert.equal(
    getAssistantReply(result),
    "전체 무대는 잘 보이고 표정을 보려면 오글이 필요해요.",
  )
})

test("free-form question is preserved while selected seats are sent as optional context", () => {
  const question = "둘 중에 엄마랑 보기 더 편한 자리가 어디야?"
  const input = buildSeatAssistantRequest(question, [
    makeReview("1", "23"),
    makeReview("2", "24"),
  ])

  assert.equal(input.question, question)
  assert.equal(input.useRag, true)
  assert.deepEqual(input.candidates, [
    { floor: "3층", section: "B", row: "4", seatNumber: "23" },
    { floor: "3층", section: "B", row: "4", seatNumber: "24" },
  ])
})

test("chat UI does not expose retrieval internals or replace the composer", () => {
  const source = readFileSync(
    new URL("./components/SeatAssistantPanel.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /AI 좌석 도우미/)
  assert.match(source, /무엇이 궁금해/)
  assert.doesNotMatch(source, /후기 검색 보강 실패/)
  assert.doesNotMatch(source, /기본 근거만 사용/)
  assert.doesNotMatch(source, /좌석 메타데이터 확인됨/)
  assert.doesNotMatch(source, /후기 기반 비교 요약/)
  assert.doesNotMatch(source, /요약에 사용한 원문 후기/)
  assert.doesNotMatch(source, /!comparisonSeats\.length\s*\?\s*<form/)
  assert.match(source, /seat-comparison-tray/)
  assert.match(source, /AI에게 비교 질문하기/)
  assert.match(source, /disabled=\{comparisonSeats\.length < 2\}/)
})

test("review cards describe comparison as a seat-selection action", () => {
  const source = readFileSync(
    new URL("../reviews/components/SeatReviewCard.tsx", import.meta.url),
    "utf8",
  )

  assert.match(source, /비교할 좌석 선택/)
  assert.match(source, /비교 좌석 선택됨/)
  assert.doesNotMatch(source, /비교함에 담기/)
})

test("chat layout keeps the conversation flexible and the composer anchored", () => {
  const component = readFileSync(
    new URL("./components/SeatAssistantPanel.tsx", import.meta.url),
    "utf8",
  )
  const styles = readFileSync(
    new URL("./components/seat-assistant-panel.css", import.meta.url),
    "utf8",
  )

  assert.match(component, /message\.id === "welcome"/)
  assert.match(component, /placeholder="예: 블루스퀘어 3층 4열 괜찮아\?"/)
  assert.match(component, /document\.body\.style\.overflow = "hidden"/)
  assert.match(component, /document\.addEventListener\("pointerdown", handlePointerDown\)/)
  assert.match(component, /event\.key !== "Escape"/)
  assert.match(component, /chatRef\.current\?\.contains\(target\)/)
  assert.match(styles, /scrollbar-width: none/)
  assert.match(styles, /seat-assistant-messages::-webkit-scrollbar/)
  assert.match(styles, /\.seat-assistant-messages \{\s+grid-area: messages;/)
  assert.match(styles, /\.seat-assistant-composer \{\s+grid-area: composer;/)
  assert.match(styles, /grid-template-rows: auto auto minmax\(0, 1fr\) auto auto;/)
})
