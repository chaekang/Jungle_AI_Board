import { useEffect, useMemo, useState } from "react"
import type { SubmitEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useReviewMetadata } from "./hooks/useReviewMetadata"
import { getTheaterSeatLayout } from "./theater-seat-layouts"
import type {
  CreateSeatReviewPayload,
  SeatLocationDraft,
  TheaterSeatLayout,
} from "./types"
import { TOKEN_KEY } from "../auth/constants"
import { createSeatReview } from "./api"
import "./styles/review-create-page.css"

function normalizeSeatText(value: string) {
  return value.trim()
}

function normalizeSeatRow(value: string) {
  return normalizeSeatText(value).toUpperCase()
}

function hasOfficialSections(layout: TheaterSeatLayout) {
  return Object.values(layout.sectionsByFloor).some((sections) => sections.length > 0)
}

const initialSeatLocation: SeatLocationDraft = {
  seatFloor: "",
  seatSection: "",
  seatRow: "",
  seatNumber: "",
}

const ratingOptions = [
  { value: 1, label: "최악" },
  { value: 2, label: "나쁨" },
  { value: 3, label: "보통" },
  { value: 4, label: "좋음" },
  { value: 5, label: "최고" },
]

const ratingFields = [
  { key: "viewRating", label: "시야" },
  { key: "soundRating", label: "음향" },
  { key: "comfortRating", label: "좌석" },
  { key: "expressionRating", label: "표정 체감" },
  { key: "stageVisibilityRating", label: "무대 전체 체감" },
] as const

export default function ReviewCreatePage() {
  const navigate = useNavigate()
  const [selectedTheaterId, setSelectedTheaterId] = useState("")
  const [isTheaterListOpen, setIsTheaterListOpen] = useState(false)
  const [selectedPerformanceId, setSelectedPerformanceId] = useState("")
  const [workSearchText, setWorkSearchText] = useState("")
  const [seatLocation, setSeatLocation] = useState<SeatLocationDraft>(initialSeatLocation)
  const [formError, setFormError] = useState("")

  const [content, setContent] = useState("")
  const [ratings, setRatings] = useState({
    viewRating: 5,
    soundRating: 5,
    comfortRating: 5,
    expressionRating: 5,
    stageVisibilityRating: 5,
  })
  const [submitMessage, setSubmitMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { theaters, workOptions, performances, isLoadingMetadata, isLoadingPerformances, error } =
    useReviewMetadata(selectedTheaterId)

  const selectedTheater = useMemo(
    () => theaters.find((theater) => theater.id === selectedTheaterId) ?? null,
    [theaters, selectedTheaterId],
  )
  const selectedTheaterName = selectedTheater?.name ?? "공연장 선택"

  const selectedPerformance = useMemo(
    () => performances.find((performance) => performance.id === selectedPerformanceId) ?? null,
    [performances, selectedPerformanceId],
  )

  const seatLayout = useMemo(() => getTheaterSeatLayout(selectedTheater), [selectedTheater])
  const needsOfficialSection = hasOfficialSections(seatLayout)
  const sections = seatLocation.seatFloor
    ? seatLayout.sectionsByFloor[seatLocation.seatFloor] ?? []
    : []
  const normalizedSearchText = workSearchText.trim().toLowerCase()
  const filteredWorkOptions = useMemo(
    () =>
      normalizedSearchText
        ? workOptions.filter((work) => work.searchText.includes(normalizedSearchText))
        : workOptions,
    [normalizedSearchText, workOptions],
  )

  useEffect(() => {
    setSelectedPerformanceId("")
    setWorkSearchText("")
    setSeatLocation(initialSeatLocation)
    setFormError("")
  }, [selectedTheaterId])

  useEffect(() => {
    if (!selectedTheaterId) {
      return
    }

    if (
      selectedPerformanceId &&
      !workOptions.some((work) => work.performanceId === selectedPerformanceId)
    ) {
      setSelectedPerformanceId("")
    }
  }, [selectedPerformanceId, selectedTheaterId, workOptions])

  useEffect(() => {
    if (
      selectedPerformanceId &&
      !filteredWorkOptions.some((work) => work.performanceId === selectedPerformanceId)
    ) {
      setSelectedPerformanceId("")
    }
  }, [filteredWorkOptions, selectedPerformanceId])

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !selectedTheaterId ||
      !selectedPerformanceId ||
      !selectedPerformance ||
      !seatLocation.seatFloor ||
      (needsOfficialSection && !seatLocation.seatSection) ||
      !seatLocation.seatRow.trim() ||
      !seatLocation.seatNumber.trim() ||
      !content.trim()
    ) {
      setFormError("공연장, 작품, 좌석 위치를 모두 선택하거나 입력해주세요.")
      return
    }

    const payload: CreateSeatReviewPayload = {
      theaterId: selectedTheaterId,
      musicalId: selectedPerformance.musicalId,
      performanceId: selectedPerformance.id,
      seatFloor: normalizeSeatText(seatLocation.seatFloor),
      seatRow: normalizeSeatRow(seatLocation.seatRow),
      seatNumber: normalizeSeatText(seatLocation.seatNumber),
      ...(needsOfficialSection
        ? { seatSection: normalizeSeatText(seatLocation.seatSection) }
        : {}),
      ...ratings,
      content: content.trim(),
    }

    setFormError("")
    setSubmitMessage("")
    setIsSubmitting(true)

    try {
      const token = localStorage.getItem(TOKEN_KEY)

      if (!token) {
        throw new Error("로그인 후 후기를 작성할 수 있습니다.")
      }

      await createSeatReview(payload, token)
      setSubmitMessage("후기가 저장되었습니다.")
    }
    catch (err) {
      setFormError(err instanceof Error ? err.message : "후기 저장에 실패했습니다.")
    }
    finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="review-create-page">
      <h1 className="review-create-title">리뷰 작성</h1>

      {error ? <p className="review-create-message review-create-message--error">{error}</p> : null}
      {formError ? (
        <p className="review-create-message review-create-message--error">{formError}</p>
      ) : null}
      {isLoadingMetadata ? (
        <p className="review-create-message">공연장 목록을 불러오는 중입니다.</p>
      ) : null}

      <form className="review-create-form" onSubmit={handleSubmit}>
        <section className="review-create-panel review-create-panel--primary">
          <div className="review-create-row">
            <span className="review-create-label">공연장</span>
            <div className="review-create-dropdown">
              <button
                className="review-create-dropdown-trigger"
                type="button"
                aria-expanded={isTheaterListOpen}
                onClick={() => setIsTheaterListOpen((isOpen) => !isOpen)}
              >
                <span>{selectedTheaterName}</span>
                <span aria-hidden="true">⌄</span>
              </button>

              {isTheaterListOpen ? (
                <div className="review-create-dropdown-menu" role="listbox" aria-label="공연장 목록">
                  {theaters.length > 0 ? (
                    theaters.map((theater) => (
                      <button
                        key={theater.id}
                        className="review-create-dropdown-option"
                        type="button"
                        aria-selected={selectedTheaterId === theater.id}
                        onClick={() => {
                          setSelectedTheaterId(theater.id)
                          setIsTheaterListOpen(false)
                        }}
                      >
                        {theater.name}
                      </button>
                    ))
                  ) : (
                    <p className="review-create-dropdown-empty">공연장 목록이 없습니다.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="review-create-row">
            <span className="review-create-label">작품</span>
            <div className="review-create-work-control">
              <input
                className="review-create-input review-create-input--work"
                value={workSearchText}
                disabled={!selectedTheaterId || isLoadingPerformances}
                onChange={(event) => {
                  setWorkSearchText(event.target.value)
                  setSelectedPerformanceId("")
                }}
                placeholder="검색어를 입력하세요"
              />

              {isLoadingPerformances ? (
                <p className="review-create-work-hint">공연 목록을 불러오는 중입니다.</p>
              ) : null}

              {selectedTheaterId && normalizedSearchText && !selectedPerformanceId ? (
                <div className="review-create-work-results" role="listbox" aria-label="작품 검색 결과">
                  {filteredWorkOptions.length > 0 ? (
                    filteredWorkOptions.map((work) => (
                      <button
                        key={work.performanceId}
                        className="review-create-work-result"
                        type="button"
                        aria-pressed={selectedPerformanceId === work.performanceId}
                        onClick={() => {
                          setSelectedPerformanceId(work.performanceId)
                          setWorkSearchText(work.displayTitle)
                        }}
                      >
                        {work.displayTitle}
                      </button>
                    ))
                  ) : (
                    <p className="review-create-work-empty">검색 결과가 없습니다.</p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="review-create-row">
            <span className="review-create-label">층</span>
            <div className="review-create-toggle-group">
              {seatLayout.floors.map((floor) => (
                <button
                  key={floor.value}
                  className="review-create-chip"
                  type="button"
                  aria-pressed={seatLocation.seatFloor === floor.value}
                  disabled={!selectedTheaterId}
                  onClick={() =>
                    setSeatLocation({ ...seatLocation, seatFloor: floor.value, seatSection: "" })
                  }
                >
                  {floor.label}
                </button>
              ))}
            </div>
          </div>

          {needsOfficialSection ? (
            <div className="review-create-row">
              <span className="review-create-label">구역</span>
              <div className="review-create-toggle-group">
                {sections.map((section) => (
                  <button
                    key={section.value}
                    className="review-create-chip"
                    type="button"
                    aria-pressed={seatLocation.seatSection === section.value}
                    disabled={!selectedTheaterId || !seatLocation.seatFloor}
                    onClick={() =>
                      setSeatLocation({ ...seatLocation, seatSection: section.value })
                    }
                  >
                    {section.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="review-create-row review-create-row--seat">
            <span className="review-create-label">열</span>
            <input
              className="review-create-input review-create-input--seat"
              value={seatLocation.seatRow}
              disabled={!selectedTheaterId}
              onChange={(event) =>
                setSeatLocation({ ...seatLocation, seatRow: event.target.value })
              }
            />
            <span className="review-create-label review-create-label--number">번호</span>
            <input
              className="review-create-input review-create-input--seat"
              value={seatLocation.seatNumber}
              disabled={!selectedTheaterId}
              onChange={(event) =>
                setSeatLocation({ ...seatLocation, seatNumber: event.target.value })
              }
            />
          </div>
        </section>

        <section className="review-create-panel">
          <h2 className="review-create-section-title">평점</h2>
          <div className="review-create-ratings">
            {ratingFields.map((field) => (
              <div className="review-create-rating-row" key={field.key}>
                <span className="review-create-rating-label">{field.label}</span>
                <div className="review-create-rating-options">
                  {ratingOptions.map((option) => (
                    <button
                      key={option.value}
                      className="review-create-chip"
                      type="button"
                      aria-pressed={ratings[field.key] === option.value}
                      onClick={() => setRatings({ ...ratings, [field.key]: option.value })}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="review-create-panel">
          <h2 className="review-create-section-title">후기</h2>
          <textarea
            className="review-create-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
        </section>

        {submitMessage ? <p className="review-create-feedback">{submitMessage}</p> : null}

        <div className="review-create-actions">
          <button className="review-create-action" type="button" onClick={() => navigate("/")}>
            나가기
          </button>
          <button className="review-create-action" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </form>
    </main>
  )
}
