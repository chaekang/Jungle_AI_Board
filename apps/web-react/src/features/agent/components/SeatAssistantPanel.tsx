import { useEffect, useMemo, useRef, useState } from "react"
import type { FormEvent, KeyboardEvent } from "react"
import { getSeatReviews } from "../../reviews/api"
import type { PublicSeatReview } from "../../reviews/types"
import { askSeatRecommendation } from "../api"
import {
  buildComparisonCandidates,
  buildComparisonQuestion,
  buildSeatEvidenceSummary,
  getComparisonSeatKey,
  getSeatLabel,
  type SeatEvidenceSummary,
} from "../seat-comparison"
import type { AgentFilters, AgentPriority, SeatRecommendation } from "../types"
import "./seat-assistant-panel.css"

const priorityOptions: Array<{ value: AgentPriority; label: string }> = [
  { value: "view", label: "시야" },
  { value: "sound", label: "음향" },
  { value: "comfort", label: "편안함" },
  { value: "expression", label: "표정" },
  { value: "stageVisibility", label: "무대 전체" },
  { value: "lowObstruction", label: "시야 방해 적음" },
]

const ratingLabels: Array<{ key: keyof PublicSeatReview["ratings"]; label: string }> = [
  { key: "view", label: "시야" },
  { key: "sound", label: "음향" },
  { key: "comfort", label: "편안함" },
  { key: "expression", label: "표정" },
  { key: "stageVisibility", label: "무대" },
]

const filterLabels: Partial<Record<keyof AgentFilters, string>> = {
  theaterName: "극장",
  musicalTitle: "공연",
  seasonLabel: "시즌",
  seatFloor: "층",
  seatSection: "구역",
  seatRow: "열",
  seatNumber: "번호",
  budget: "예산 참고",
}

type ChatMessage = {
  id: string
  role: "assistant" | "user"
  text: string
  result?: SeatRecommendation
}

type SeatAssistantPanelProps = {
  comparisonSeats?: PublicSeatReview[]
  comparisonMessage?: string
  onClearComparison?: () => void
  onEvidenceSelect?: (reviewId: string) => void
  onRelaxSearch?: (seat: PublicSeatReview) => void
  onRemoveComparisonSeat?: (review: PublicSeatReview) => void
  onWriteReview?: () => void
}

function makeMessageId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getResultStatus(result: SeatRecommendation) {
  if (result.evidenceReviews.length === 0) {
    return "아직 판단할 후기가 부족함"
  }
  if (result.ragStatus === "skipped") {
    return "선택 후기 비교 · 일반 RAG 미사용"
  }
  if (result.ragStatus === "ok") {
    return "후기 검색으로 근거 보강"
  }
  if (result.ragStatus === "fallback") {
    return "후기 검색 보강 실패 · 기본 근거만 사용"
  }
  return "직접 찾은 후기 근거 사용"
}

function getToolStatus(result: SeatRecommendation) {
  if (result.mcpStatus === "ok") {
    return "좌석 메타데이터 확인됨"
  }
  if (result.mcpStatus === "fallback") {
    return "좌석 메타데이터 대체 정보 사용"
  }
  return "좌석 메타데이터 미사용"
}

function getFilterChips(filters: AgentFilters) {
  const chips: string[] = []
  Object.entries(filterLabels).forEach(([key, label]) => {
    const value = filters[key as keyof AgentFilters]
    if (typeof value === "string" || typeof value === "number") {
      chips.push(`${label} ${key === "budget" ? `${Number(value).toLocaleString()}원` : value}`)
    }
  })
  filters.priorities.forEach((priority) => {
    const label = priorityOptions.find((option) => option.value === priority)?.label
    if (label) chips.push(`우선 ${label}`)
  })
  return chips
}

function EvidenceButton({
  review,
  label,
  onSelect,
}: {
  review: PublicSeatReview
  label: string
  onSelect?: (reviewId: string) => void
}) {
  return (
    <button
      className="seat-evidence-review"
      type="button"
      onClick={() => onSelect?.(review.id)}
    >
      <span>{label}</span>
      <p>{review.content}</p>
      <small>원문 후기 보기 →</small>
    </button>
  )
}

function RecommendationResult({
  result,
  onEvidenceSelect,
  statusOverride,
}: {
  result: SeatRecommendation
  onEvidenceSelect?: (reviewId: string) => void
  statusOverride?: string
}) {
  const filterChips = getFilterChips(result.filters)

  return (
    <section className="seat-recommendation-result" aria-label="후기 기반 비교 요약">
      <header>
        <div>
          <p>후기 기반 비교 요약</p>
          <h3>{result.recommendation}</h3>
        </div>
        <span>{statusOverride ?? getResultStatus(result)}</span>
      </header>

      <div className="seat-result-statuses">
        <span>{getToolStatus(result)}</span>
        <span>근거 후기 {result.evidenceReviews.length}개</span>
      </div>

      {filterChips.length > 0 ? (
        <div className="seat-result-filters" aria-label="비교 조건">
          {filterChips.map((filter) => <span key={filter}>{filter}</span>)}
        </div>
      ) : null}

      {result.reasons.length > 0 ? (
        <section className="seat-result-list seat-result-list--reason">
          <h4>이렇게 요약했어요</h4>
          <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        </section>
      ) : null}

      {result.cautions.length > 0 ? (
        <section className="seat-result-list seat-result-list--caution">
          <h4>함께 볼 주의 근거</h4>
          <ul>{result.cautions.map((caution) => <li key={caution}>{caution}</li>)}</ul>
        </section>
      ) : null}

      {result.evidenceReviews.length > 0 ? (
        <section className="seat-result-evidence">
          <h4>요약에 사용한 원문 후기</h4>
          {result.evidenceReviews.map((review) => (
            <button key={review.id} type="button" onClick={() => onEvidenceSelect?.(review.id)}>
              <strong>{review.seat}</strong>
              <span>{review.content}</span>
              <small>원문 후기 열기 →</small>
            </button>
          ))}
        </section>
      ) : (
        <p className="seat-result-empty-evidence">
          연결할 원문 후기가 없어 생성형 답변을 만들지 않았습니다.
        </p>
      )}
    </section>
  )
}

async function loadSeatEvidence(seat: PublicSeatReview) {
  const baseParams = {
    theaterId: seat.theater.id,
    performanceId: seat.performance?.id,
    musicalId: seat.performance ? undefined : seat.musical.id,
    seatFloor: seat.seat.floor,
    seatSection: seat.seat.section ?? undefined,
    limit: 50,
  } as const
  const direct = await getSeatReviews({
    ...baseParams,
    seatRow: seat.seat.row,
    seatNumber: seat.seat.number,
  })
  let nearbyReviews: PublicSeatReview[] = []
  let sectionReviews: PublicSeatReview[] = []

  if (direct.total === 0) {
    const nearby = await getSeatReviews({ ...baseParams, seatRow: seat.seat.row })
    const directIds = new Set(direct.items.map((review) => review.id))
    nearbyReviews = nearby.items.filter((review) => !directIds.has(review.id)).slice(0, 5)

    if (nearbyReviews.length === 0) {
      const section = await getSeatReviews(baseParams)
      sectionReviews = section.items.filter((review) => !directIds.has(review.id)).slice(0, 5)
    }
  }

  return buildSeatEvidenceSummary({
    seat,
    directReviews: direct.items,
    nearbyReviews,
    sectionReviews,
    totalDirectReviews: direct.total,
  })
}

export default function SeatAssistantPanel({
  comparisonSeats = [],
  comparisonMessage = "",
  onClearComparison,
  onEvidenceSelect,
  onRelaxSearch,
  onRemoveComparisonSeat,
  onWriteReview,
}: SeatAssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "후기 카드나 좌석도에서 2~3개 좌석을 비교함에 담아 보세요. 막연한 추천보다 실제 후기와 주의 근거를 나란히 보여드릴게요.",
    },
  ])
  const [summaries, setSummaries] = useState<SeatEvidenceSummary[]>([])
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(false)
  const [evidenceReloadKey, setEvidenceReloadKey] = useState(0)
  const [comparisonResult, setComparisonResult] = useState<SeatRecommendation | null>(null)
  const [priorities, setPriorities] = useState<AgentPriority[]>(["view"])
  const [budget, setBudget] = useState<number | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const evidenceCacheRef = useRef(new Map<string, SeatEvidenceSummary>())
  const comparisonRequestVersionRef = useRef(0)


  const firstSeat = comparisonSeats[0]
  const hasCompleteEvidence =
    comparisonSeats.length > 0 &&
    comparisonSeats.every((seat) =>
      summaries.some(
        (summary) => getComparisonSeatKey(summary.seat) === getComparisonSeatKey(seat),
      ),
    )
  const hasInsufficientEvidence = summaries.some((summary) => summary.evidenceLevel === "none")
  const needsNarrowing = summaries.some((summary) => summary.evidenceLevel !== "direct")
  const compareSubmitDisabled =
    comparisonSeats.length < 2 ||
    !hasCompleteEvidence ||
    isLoading ||
    isLoadingEvidence ||
    hasInsufficientEvidence
  let compareSubmitLabel = "후기 기반 비교 요약 보기"
  if (comparisonSeats.length < 2) {
    compareSubmitLabel = "좌석을 하나 더 담아주세요"
  } else if (hasInsufficientEvidence) {
    compareSubmitLabel = "원문 후기가 생기면 비교할 수 있어요"
  } else if (!hasCompleteEvidence && !isLoadingEvidence) {
    compareSubmitLabel = "근거를 다시 확인해 주세요"
  } else if (isLoading) {
    compareSubmitLabel = "후기를 비교하는 중"
  }
  const contextChips = useMemo(() => {
    if (!firstSeat) return []
    return [
      firstSeat.theater.name,
      [firstSeat.performance?.seasonLabel, firstSeat.musical.title].filter(Boolean).join(" "),
      ...new Set(comparisonSeats.map((seat) => [seat.seat.floor, seat.seat.section ? `${seat.seat.section}구역` : ""].filter(Boolean).join(" "))),
    ].filter(Boolean)
  }, [comparisonSeats, firstSeat])

  useEffect(() => {
    comparisonRequestVersionRef.current += 1
    if (!isOpen) return

    let isMounted = true
    void Promise.resolve().then(async () => {
      if (!comparisonSeats.length) {
        if (isMounted) {
          setSummaries([])
          setComparisonResult(null)
        }
        return
      }

      if (isMounted) {
        setSummaries([])
        setIsLoadingEvidence(true)
        setIsLoading(false)
        setComparisonResult(null)
        setError("")
      }

      try {
        const nextSummaries = await Promise.all(
          comparisonSeats.map(async (seat) => {
            const seatKey = getComparisonSeatKey(seat)
            const cachedSummary = evidenceCacheRef.current.get(seatKey)
            if (cachedSummary) return cachedSummary

            const summary = await loadSeatEvidence(seat)
            evidenceCacheRef.current.set(seatKey, summary)
            return summary
          }),
        )
        if (isMounted) setSummaries(nextSummaries)
      } catch (err) {
        if (isMounted) {
          setSummaries([])
          setError(err instanceof Error ? err.message : "비교 근거를 불러오지 못했습니다.")
        }
      } finally {
        if (isMounted) setIsLoadingEvidence(false)
      }
    })

    return () => { isMounted = false }
  }, [comparisonSeats, evidenceReloadKey, isOpen])

  useEffect(() => {
    if (isOpen) messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [isOpen, messages, isLoading, comparisonResult])

  async function requestComparison() {
    if (comparisonSeats.length < 2 || isLoading || isLoadingEvidence) return
    const requestVersion = ++comparisonRequestVersionRef.current
    setError("")
    setComparisonResult(null)
    if (hasInsufficientEvidence) return
    setIsLoading(true)
    try {
      const result = await askSeatRecommendation({
        question: buildComparisonQuestion(comparisonSeats, priorities),
        theaterName: firstSeat?.theater.name,
        musicalTitle: firstSeat?.musical.title,
        seasonLabel: firstSeat?.performance?.seasonLabel ?? undefined,
        priorities,
        candidates: buildComparisonCandidates(comparisonSeats),
        budget,
        limit: 10,
        useRag: false,
      })
      if (comparisonRequestVersionRef.current === requestVersion) setComparisonResult(result)
    } catch (err) {
      if (comparisonRequestVersionRef.current === requestVersion) {
        setError(err instanceof Error ? err.message : "비교 요약을 불러오지 못했습니다.")
      }
    } finally {
      if (comparisonRequestVersionRef.current === requestVersion) setIsLoading(false)
    }
  }

  function togglePriority(priority: AgentPriority) {
    comparisonRequestVersionRef.current += 1
    setComparisonResult(null)
    setIsLoading(false)
    setPriorities((current) =>
      current.includes(priority)
        ? current.filter((item) => item !== priority)
        : [...current, priority],
    )
  }

  function toggleBudget(value: number) {
    comparisonRequestVersionRef.current += 1
    setComparisonResult(null)
    setIsLoading(false)
    setBudget((current) => (current === value ? undefined : value))
  }

  function retryEvidence() {
    comparisonSeats.forEach((seat) => {
      evidenceCacheRef.current.delete(getComparisonSeatKey(seat))
    })
    setEvidenceReloadKey((current) => current + 1)
  }

  async function submitQuestion(question: string) {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isLoading) return
    setMessages((current) => [...current, { id: makeMessageId(), role: "user", text: trimmedQuestion }])
    setInput("")
    setError("")
    setIsLoading(true)
    try {
      const result = await askSeatRecommendation({ question: trimmedQuestion, limit: 5, useRag: true })
      setMessages((current) => [...current, { id: makeMessageId(), role: "assistant", text: result.recommendation, result }])
    } catch (err) {
      setError(err instanceof Error ? err.message : "답변을 불러오지 못했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submitQuestion(input)
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      void submitQuestion(input)
    }
  }

  return (
    <>
      <button
        className={`seat-assistant-launcher ${comparisonSeats.length ? "seat-assistant-launcher--comparison" : ""}`}
        type="button"
        aria-label={isOpen ? "좌석 비교함 닫기" : "좌석 비교함 열기"}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{comparisonSeats.length ? `비교 ${comparisonSeats.length}` : "AI"}</span>
      </button>

      {isOpen ? (
        <section className="seat-assistant-chat" aria-label="좌석 후기 비교함">
          <header className="seat-assistant-chat-header">
            <div><p>좌석 후기 비교함</p><h2>후기를 나란히 확인해요</h2></div>
            <button type="button" aria-label="좌석 비교함 닫기" onClick={() => setIsOpen(false)}>×</button>
          </header>

          <div className="seat-assistant-messages" role="log" aria-live="polite">
            {comparisonSeats.length ? (
              <section className="seat-comparison-workspace">
                <header>
                  <div><p>{comparisonSeats.length}/3 좌석</p><h3>선택한 좌석</h3></div>
                  <button type="button" onClick={onClearComparison}>전체 비우기</button>
                </header>

                <div className="seat-context-chips" aria-label="현재 비교 조건">
                  {contextChips.map((chip) => <span key={chip}>{chip}</span>)}
                </div>

                {comparisonMessage ? <p className="seat-comparison-notice">{comparisonMessage}</p> : null}
                {isLoadingEvidence ? <p className="seat-comparison-loading">원문 후기를 모으는 중입니다.</p> : null}

                <div className="seat-comparison-columns">
                  {comparisonSeats.map((seat) => {
                    const summary = summaries.find((item) => getComparisonSeatKey(item.seat) === getComparisonSeatKey(seat))
                    return (
                      <article className="seat-comparison-card" key={getComparisonSeatKey(seat)}>
                        <header><div><small>{seat.musical.title}</small><h4>{getSeatLabel(seat)}</h4></div><button type="button" aria-label={`${getSeatLabel(seat)} 비교함에서 빼기`} onClick={() => onRemoveComparisonSeat?.(seat)}>×</button></header>
                        {summary ? (
                          <>
                            <div className="seat-sample-line"><strong>후기 {summary.reviewCount}개</strong><span data-level={summary.evidenceLevel}>{summary.evidenceLabel}</span></div>
                            {summary.sampleWarning ? <p className="seat-sample-warning">{summary.sampleWarning}</p> : null}
                            <dl className="seat-rating-grid">
                              {ratingLabels.map(({ key, label }) => <div key={key}><dt>{label}</dt><dd><span style={{ width: `${summary.averageRatings[key] * 20}%` }} /><b>{summary.averageRatings[key] ? summary.averageRatings[key].toFixed(1) : "-"}</b></dd></div>)}
                            </dl>
                            {summary.frequentTags.length ? <div className="seat-frequent-tags">{summary.frequentTags.map((tag) => <span key={tag}>#{tag}</span>)}</div> : null}
                            {summary.positiveReview ? <EvidenceButton label="긍정 후기" review={summary.positiveReview} onSelect={onEvidenceSelect} /> : <p className="seat-evidence-missing">긍정 근거를 고를 원문 후기가 없습니다.</p>}
                            {summary.cautionReview ? <EvidenceButton label="주의·반대 후기" review={summary.cautionReview} onSelect={onEvidenceSelect} /> : <p className="seat-evidence-missing">현재 표본에서는 뚜렷한 반대 후기가 확인되지 않았습니다.</p>}
                            {summary.fallbackReviews[0] ? <EvidenceButton label={summary.evidenceLabel} review={summary.fallbackReviews[0]} onSelect={onEvidenceSelect} /> : null}
                          </>
                        ) : null}
                      </article>
                    )
                  })}
                </div>

                <section className="seat-narrow-panel">
                  <h4>{hasInsufficientEvidence ? "후기가 부족해 조건을 더 확인할게요" : "무엇을 우선해서 볼까요?"}</h4>
                  <div className="seat-priority-chips">{priorityOptions.map((option) => <button key={option.value} type="button" aria-pressed={priorities.includes(option.value)} onClick={() => togglePriority(option.value)}>{option.label}</button>)}</div>
                  <div className="seat-budget-chips"><span>예산</span>{[100000, 150000].map((value) => <button key={value} type="button" aria-pressed={budget === value} onClick={() => toggleBudget(value)}>{(value / 10000).toFixed(0)}만원 이하</button>)}</div>
                  <p className="seat-budget-note">가격 데이터와 직접 대조하지 않고, 선택 조건으로만 함께 표시합니다.</p>
                </section>

                {needsNarrowing && firstSeat ? (
                  <div className="seat-narrow-actions">
                    <button type="button" onClick={() => onRelaxSearch?.(firstSeat)}>조건을 완화해 검색</button>
                    <button type="button" onClick={() => onWriteReview?.()}>이 좌석 후기 작성</button>
                  </div>
                ) : null}

                <button className="seat-compare-submit" type="button" disabled={compareSubmitDisabled} onClick={() => void requestComparison()}>{compareSubmitLabel}</button>
                {comparisonResult ? <RecommendationResult result={comparisonResult} onEvidenceSelect={onEvidenceSelect} statusOverride={needsNarrowing ? "직접 후기 부족 · 인접/구역 근거 참고" : undefined} /> : null}
              </section>
            ) : messages.map((message) => (
              <article className={`seat-assistant-message seat-assistant-message--${message.role}`} key={message.id}>
                {message.result ? <RecommendationResult result={message.result} onEvidenceSelect={onEvidenceSelect} /> : <p>{message.text}</p>}
              </article>
            ))}

            {isLoading ? <article className="seat-assistant-message seat-assistant-message--assistant"><div className="seat-assistant-typing" aria-label="답변 작성 중"><span /><span /><span /></div></article> : null}
            <div ref={messageEndRef} />
          </div>

          {error ? <div className="seat-assistant-error"><p>{error}</p>{comparisonSeats.length && !hasCompleteEvidence && !isLoadingEvidence ? <button type="button" onClick={retryEvidence}>근거 다시 불러오기</button> : null}</div> : null}
          {!comparisonSeats.length ? <form className="seat-assistant-composer" onSubmit={handleSubmit}><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={handleInputKeyDown} placeholder="예: 블루스퀘어 2층 중앙 시야 괜찮아?" rows={1} /><button type="submit" disabled={isLoading || !input.trim()}>보내기</button></form> : null}
        </section>
      ) : null}
    </>
  )
}