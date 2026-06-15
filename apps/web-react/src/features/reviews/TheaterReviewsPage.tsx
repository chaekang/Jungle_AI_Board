import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { getCurrentUser } from "../auth/api"
import SeatAssistantPanel from "../agent/components/SeatAssistantPanel"
import ReviewComments from "../comments/components/ReviewComments"
import SeatReviewCard from "./components/SeatReviewCard"
import { deleteSeatReview, getTheaters, reportSeatReview } from "./api"
import { useSeatReviews } from "./hooks/useSeatReviews"
import { getSortedUniqueSeatValues } from "./review-board-filters"
import {
  buildSeatReviewSearchQuery,
  type ReviewBoardSeatFilter,
  type ReviewBoardSortKey,
} from "./review-search-query"
import { getCanonicalTheaterName, theaterSeatMapNames } from "./theater-seat-map-index"
import type { PublicUser } from "../auth/types"
import type { PublicSeatReview, SeatReviewSearchParams, TheaterOption } from "./types"
import "./styles/review-board-page.css"
import "./styles/theater-reviews-page.css"

const TheaterSeatMap = lazy(() => import("./components/TheaterSeatMap"))

type ViewMode = "board" | "seatMap"
type RatingFilterKey = "view" | "sound" | "comfort" | "stageVisibility"

type RatingFilters = Record<RatingFilterKey, string>

const reviewPageLimit = 12

const initialSeatFilter: ReviewBoardSeatFilter = {
  floor: "",
  section: "",
  row: "",
  number: "",
}

const initialRatingFilters: RatingFilters = {
  view: "",
  sound: "",
  comfort: "",
  stageVisibility: "",
}

const sortLabels: Record<ReviewBoardSortKey, string> = {
  latest: "최신 후기",
  oldest: "오래된 후기",
  popular: "인기 많은 순",
  rating: "평점 높은 순",
  viewHigh: "시야 좋은 순",
  soundHigh: "음향 좋은 순",
  comfortHigh: "좌석 편한 순",
  expressionHigh: "표정 잘 보이는 순",
  stageVisibilityHigh: "무대 전체 잘 보이는 순",
}

const sortOptions: ReviewBoardSortKey[] = [
  "latest",
  "popular",
  "rating",
  "viewHigh",
  "stageVisibilityHigh",
  "soundHigh",
  "comfortHigh",
]

const ratingFilterLabels: Record<RatingFilterKey, string> = {
  view: "시야",
  sound: "음향",
  comfort: "좌석",
  stageVisibility: "무대",
}

const ratingOptions = ["", "3", "4", "5"]

function parseRatingFilter(value: string) {
  return value ? Number(value) : undefined
}

function getTheaterById(theaters: TheaterOption[], theaterId: string | undefined) {
  if (!theaterId) {
    return null
  }

  return theaters.find((theater) => theater.id === theaterId) ?? null
}

export default function TheaterReviewsPage() {
  const navigate = useNavigate()
  const { theaterId } = useParams()
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null)
  const [theaters, setTheaters] = useState<TheaterOption[]>([])
  const [isLoadingTheaters, setIsLoadingTheaters] = useState(true)
  const [theaterError, setTheaterError] = useState("")
  const [searchText, setSearchText] = useState("")
  const [tagText, setTagText] = useState("")
  const [sortKey, setSortKey] = useState<ReviewBoardSortKey>("latest")
  const [seatFilter, setSeatFilter] = useState<ReviewBoardSeatFilter>(initialSeatFilter)
  const [ratingFilters, setRatingFilters] = useState<RatingFilters>(initialRatingFilters)
  const [reviewPage, setReviewPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [selectedReview, setSelectedReview] = useState<PublicSeatReview | null>(null)
  const [actionError, setActionError] = useState("")
  const selectedTheater = getTheaterById(theaters, theaterId)
  const theaterName = selectedTheater ? getCanonicalTheaterName(selectedTheater.name) : ""
  const canShowSeatMap = Boolean(theaterName && theaterSeatMapNames.has(theaterName))
  const effectiveViewMode: ViewMode = viewMode === "seatMap" && canShowSeatMap ? "seatMap" : "board"

  const reviewSearchParams = useMemo<SeatReviewSearchParams>(
    () =>
      theaterId
        ? {
            ...buildSeatReviewSearchQuery({
              page: reviewPage,
              limit: reviewPageLimit,
              fixedTheaterId: theaterId,
              searchText,
              selectedFilter: null,
              seatFilter,
              sortKey,
            }),
            tag: tagText.trim() || undefined,
            minViewRating: parseRatingFilter(ratingFilters.view),
            minSoundRating: parseRatingFilter(ratingFilters.sound),
            minComfortRating: parseRatingFilter(ratingFilters.comfort),
            minStageVisibilityRating: parseRatingFilter(ratingFilters.stageVisibility),
          }
        : { page: reviewPage, limit: reviewPageLimit },
    [ratingFilters, reviewPage, searchText, seatFilter, sortKey, tagText, theaterId],
  )

  const {
    reviews,
    total,
    page,
    limit,
    hasNext,
    isLoading,
    error,
    removeReview,
  } = useSeatReviews(reviewSearchParams, {
    enabled: Boolean(theaterId && selectedTheater),
  })
  const {
    reviews: seatMapReviews,
    isLoading: isLoadingSeatMapReviews,
    error: seatMapError,
    removeReview: removeSeatMapReview,
  } = useSeatReviews(reviewSearchParams, {
    enabled: Boolean(theaterId && selectedTheater && canShowSeatMap),
    loadAllPages: true,
  })
  const viewReviews = effectiveViewMode === "seatMap" ? seatMapReviews : reviews
  const viewIsLoading = effectiveViewMode === "seatMap" ? isLoadingSeatMapReviews : isLoading
  const viewError = effectiveViewMode === "seatMap" ? seatMapError : error
  const isAuthenticated = Boolean(currentUser)
  const totalPages = Math.max(1, Math.ceil(total / limit))

  const floorOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...getSortedUniqueSeatValues(viewReviews, (review) => review.seat.floor),
          seatFilter.floor,
        ].filter((value): value is string => Boolean(value))),
      ),
    [seatFilter.floor, viewReviews],
  )

  const sectionOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...getSortedUniqueSeatValues(viewReviews, (review) => review.seat.section),
          seatFilter.section,
        ].filter((value): value is string => Boolean(value))),
      ),
    [seatFilter.section, viewReviews],
  )

  useEffect(() => {
    let isMounted = true

    async function loadTheaters() {
      try {
        setTheaterError("")
        setIsLoadingTheaters(true)
        const theaterData = await getTheaters()

        if (isMounted) {
          setTheaters(theaterData)
        }
      } catch (err) {
        if (isMounted) {
          setTheaterError(err instanceof Error ? err.message : "극장 정보를 불러오지 못했습니다.")
        }
      } finally {
        if (isMounted) {
          setIsLoadingTheaters(false)
        }
      }
    }

    void loadTheaters()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadCurrentUser() {
      try {
        const user = await getCurrentUser()

        if (isMounted) {
          setCurrentUser(user)
        }
      } catch {
        if (isMounted) {
          setCurrentUser(null)
        }
      }
    }

    void loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!selectedReview) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedReview(null)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [selectedReview])

  function updateSeatFilter(nextSeatFilter: ReviewBoardSeatFilter) {
    setReviewPage(1)
    setSeatFilter(nextSeatFilter)
  }

  function handleWriteReview() {
    if (isAuthenticated) {
      navigate("/reviews/new")
      return
    }

    navigate("/auth", { state: { redirectTo: "/reviews/new" } })
  }

  function handleEditReview(review: PublicSeatReview) {
    navigate(`/reviews/${review.id}/edit`)
  }

  async function handleDeleteReview(review: PublicSeatReview) {
    if (!isAuthenticated) {
      navigate("/auth", { state: { redirectTo: `/theaters/${theaterId}` } })
      return
    }

    if (!window.confirm("정말 이 후기를 삭제하시겠습니까?")) {
      return
    }

    try {
      setActionError("")
      await deleteSeatReview(review.id)
      removeReview(review.id)
      removeSeatMapReview(review.id)

      if (selectedReview?.id === review.id) {
        setSelectedReview(null)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "후기 삭제에 실패했습니다.")
    }
  }

  async function handleReportReview(review: PublicSeatReview) {
    if (!isAuthenticated) {
      navigate("/auth", { state: { redirectTo: `/theaters/${theaterId}` } })
      return
    }

    const reason = window.prompt("Report reason")
    if (!reason?.trim()) {
      return
    }

    try {
      setActionError("")
      await reportSeatReview(review.id, reason.trim())
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to report review.")
    }
  }

  if (isLoadingTheaters) {
    return (
      <main className="review-board-page theater-reviews-page">
        <section className="theater-reviews-empty">
          <p>극장 정보를 불러오는 중입니다.</p>
        </section>
      </main>
    )
  }

  if (theaterError) {
    return (
      <main className="review-board-page theater-reviews-page">
        <section className="theater-reviews-empty theater-reviews-empty--error">
          <p>{theaterError}</p>
          <Link to="/">전체 후기 게시판으로 돌아가기</Link>
        </section>
      </main>
    )
  }

  if (!selectedTheater) {
    return (
      <main className="review-board-page theater-reviews-page">
        <section className="theater-reviews-empty">
          <p>찾을 수 없는 극장입니다.</p>
          <Link to="/">전체 후기 게시판으로 돌아가기</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="review-board-page theater-reviews-page">
      <div className="review-board-shell theater-reviews-shell">
        <header className="theater-reviews-header">
          <div>
            <Link className="theater-reviews-back-link" to="/">
              전체 후기
            </Link>
            <h1>{theaterName}</h1>
            <p>이 극장의 좌석 후기만 모아 보고, 좌석 위치와 태그로 좁혀볼 수 있습니다.</p>
          </div>
          <button className="review-board-write-button" type="button" onClick={handleWriteReview}>
            후기 작성
          </button>
        </header>

        <section className="theater-reviews-controls">
          <div className="theater-reviews-search-row">
            <input
              className="review-board-main-search"
              value={searchText}
              onChange={(event) => {
                setReviewPage(1)
                setSearchText(event.target.value)
              }}
              placeholder={`${theaterName} 후기 검색`}
            />
            <input
              className="theater-reviews-tag-search"
              value={tagText}
              onChange={(event) => {
                setReviewPage(1)
                setTagText(event.target.value)
              }}
              placeholder="태그 검색"
            />
          </div>

          <div className="theater-reviews-control-grid">
            <label>
              정렬
              <select
                value={sortKey}
                onChange={(event) => {
                  setReviewPage(1)
                  setSortKey(event.target.value as ReviewBoardSortKey)
                }}
              >
                {sortOptions.map((option) => (
                  <option key={option} value={option}>
                    {sortLabels[option]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              층
              <select
                value={seatFilter.floor}
                onChange={(event) =>
                  updateSeatFilter({
                    ...seatFilter,
                    floor: event.target.value,
                  })
                }
              >
                <option value="">전체</option>
                {floorOptions.map((floor) => (
                  <option key={floor} value={floor}>
                    {floor}
                  </option>
                ))}
              </select>
            </label>

            <label>
              구역
              <select
                value={seatFilter.section}
                onChange={(event) =>
                  updateSeatFilter({
                    ...seatFilter,
                    section: event.target.value,
                  })
                }
              >
                <option value="">전체</option>
                {sectionOptions.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>

            <label>
              열
              <input
                value={seatFilter.row}
                onChange={(event) => updateSeatFilter({ ...seatFilter, row: event.target.value })}
                placeholder="7"
              />
            </label>

            <label>
              번호
              <input
                value={seatFilter.number}
                onChange={(event) =>
                  updateSeatFilter({ ...seatFilter, number: event.target.value })
                }
                placeholder="15"
              />
            </label>
          </div>

          <div className="theater-reviews-rating-grid">
            {(Object.keys(ratingFilterLabels) as RatingFilterKey[]).map((key) => (
              <label key={key}>
                {ratingFilterLabels[key]} 최소
                <select
                  value={ratingFilters[key]}
                  onChange={(event) => {
                    setReviewPage(1)
                    setRatingFilters((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }}
                >
                  {ratingOptions.map((rating) => (
                    <option key={rating || "all"} value={rating}>
                      {rating ? `${rating}점 이상` : "전체"}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                setReviewPage(1)
                setSeatFilter(initialSeatFilter)
                setRatingFilters(initialRatingFilters)
                setTagText("")
              }}
            >
              필터 초기화
            </button>
          </div>

          <div className="review-board-view-tabs theater-reviews-view-tabs">
            <button
              type="button"
              aria-pressed={effectiveViewMode === "board"}
              onClick={() => setViewMode("board")}
            >
              후기 목록
            </button>
            {canShowSeatMap ? (
              <button
                type="button"
                aria-pressed={effectiveViewMode === "seatMap"}
                onClick={() => setViewMode("seatMap")}
              >
                좌석배치도
              </button>
            ) : null}
          </div>
        </section>

        <section className="review-board-list-panel theater-reviews-list-panel">
          {viewIsLoading ? <p className="review-board-state">후기 목록을 불러오는 중입니다.</p> : null}
          {viewError ? <p className="review-board-state review-board-state--error">{viewError}</p> : null}
          {actionError ? (
            <p className="review-board-state review-board-state--error">{actionError}</p>
          ) : null}

          {!viewError && effectiveViewMode === "board" ? (
            <div className="review-board-result-summary">
              <span>
                총 {total.toLocaleString()}개 · {page}/{totalPages}페이지
              </span>
              <div className="review-board-pagination">
                <button
                  type="button"
                  disabled={viewIsLoading || page <= 1}
                  onClick={() => setReviewPage((currentPage) => Math.max(1, currentPage - 1))}
                >
                  이전
                </button>
                <button
                  type="button"
                  disabled={viewIsLoading || !hasNext}
                  onClick={() => setReviewPage((currentPage) => currentPage + 1)}
                >
                  다음
                </button>
              </div>
            </div>
          ) : null}

          {!viewIsLoading && !viewError ? (
            effectiveViewMode === "seatMap" ? (
              <Suspense fallback={<p className="review-board-state">좌석배치도를 불러오는 중입니다.</p>}>
                <TheaterSeatMap
                  currentUserId={currentUser?.id}
                  onDeleteReview={handleDeleteReview}
                  onEditReview={handleEditReview}
                  reviews={seatMapReviews}
                  theaterName={theaterName}
                />
              </Suspense>
            ) : (
              <div className="review-board-list">
                {reviews.length > 0 ? (
                  reviews.map((review) => (
                    <SeatReviewCard
                      canManage={review.author.id === currentUser?.id}
                      key={review.id}
                      onDelete={handleDeleteReview}
                      onEdit={handleEditReview}
                      onReport={handleReportReview}
                      onSelect={setSelectedReview}
                      review={review}
                    />
                  ))
                ) : (
                  <p className="review-board-state">보여줄 후기가 없습니다.</p>
                )}
              </div>
            )
          ) : null}
        </section>
      </div>

      {selectedReview ? (
        <div
          className="review-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-detail-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedReview(null)
            }
          }}
        >
          <section className="review-detail-card">
            <header>
              <div>
                <p>선택한 후기</p>
                <h2 id="review-detail-title">후기 상세</h2>
              </div>
              <button type="button" onClick={() => setSelectedReview(null)}>
                닫기
              </button>
            </header>
            <SeatReviewCard
              canManage={selectedReview.author.id === currentUser?.id}
              onDelete={handleDeleteReview}
              onEdit={handleEditReview}
              onReport={handleReportReview}
              review={selectedReview}
              variant="detail"
            />
            <ReviewComments
              currentUserId={currentUser?.id}
              isAuthenticated={isAuthenticated}
              reviewId={selectedReview.id}
            />
          </section>
        </div>
      ) : null}

      <SeatAssistantPanel />
    </main>
  )
}
