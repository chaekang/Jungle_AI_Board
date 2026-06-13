import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getCurrentUser } from "../auth/api"
import { TOKEN_KEY } from "../auth/constants"
import ReviewComments from "../comments/components/ReviewComments"
import SeatReviewCard from "./components/SeatReviewCard"
import { deleteSeatReview } from "./api"
import { useSeatReviews } from "./hooks/useSeatReviews"
import {
  getCanonicalTheaterName,
  theaterSeatMapNames,
  theaterSeatMapOptions,
} from "./theater-seat-map-index"
import {
  getReviewBoardDisplayReviews,
  getReviewTags,
  getSeatFilterScopeReviews,
  getSortedUniqueSeatValues,
  type ReviewBoardFilter,
} from "./review-board-filters"
import type { PublicUser } from "../auth/types"
import type { PublicSeatReview } from "./types"
import "./styles/review-board-page.css"

const TheaterSeatMap = lazy(() => import("./components/TheaterSeatMap"))

type FilterMode = "theater" | "work" | "tag"
type ViewMode = "board" | "seatMap"
type SortKey =
  | "latest"
  | "viewHigh"
  | "viewLow"
  | "soundHigh"
  | "soundLow"
  | "comfortHigh"
  | "comfortLow"
  | "expressionHigh"
  | "expressionLow"
  | "stageVisibilityHigh"
  | "stageVisibilityLow"

type SeatFilter = {
  floor: string
  section: string
  rowRange: string
  numberRange: string
}

const sortLabels: Record<SortKey, string> = {
  latest: "최신 후기",
  viewHigh: "시야 좋은순",
  viewLow: "시야 아쉬운순",
  soundHigh: "음향 좋은순",
  soundLow: "음향 아쉬운순",
  comfortHigh: "좌석 편한순",
  comfortLow: "좌석 불편한순",
  expressionHigh: "표정 잘 보이는순",
  expressionLow: "표정 먼순",
  stageVisibilityHigh: "무대 전체 잘 보이는순",
  stageVisibilityLow: "무대 전체 아쉬운순",
}

const sortGroups: Array<{ label: string; keys: SortKey[] }> = [
  { label: "기본", keys: ["latest"] },
  { label: "시야", keys: ["viewHigh", "viewLow", "stageVisibilityHigh", "stageVisibilityLow"] },
  { label: "관람감", keys: ["soundHigh", "soundLow", "comfortHigh", "comfortLow"] },
  { label: "배우", keys: ["expressionHigh", "expressionLow"] },
]

const initialSeatFilter: SeatFilter = {
  floor: "",
  section: "",
  rowRange: "",
  numberRange: "",
}

const filterResultLabels: Record<FilterMode, string> = {
  theater: "극장 검색 결과",
  work: "작품 검색 결과",
  tag: "태그 검색 결과",
}

function getWorkLabel(review: PublicSeatReview) {
  return [review.performance?.seasonLabel, review.musical.title].filter(Boolean).join(" ")
}

function getSortValue(review: PublicSeatReview, sortKey: SortKey) {
  switch (sortKey) {
    case "viewHigh":
    case "viewLow":
      return review.ratings.view
    case "soundHigh":
    case "soundLow":
      return review.ratings.sound
    case "comfortHigh":
    case "comfortLow":
      return review.ratings.comfort
    case "expressionHigh":
    case "expressionLow":
      return review.ratings.expression
    case "stageVisibilityHigh":
    case "stageVisibilityLow":
      return review.ratings.stageVisibility
    case "latest":
    default:
      return new Date(review.createdAt).getTime()
  }
}

function isAscendingSort(sortKey: SortKey) {
  return sortKey.endsWith("Low")
}

function makeUniqueFilters(reviews: PublicSeatReview[], mode: FilterMode, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  const options = new Map<string, ReviewBoardFilter>()

  reviews.forEach((review) => {
    if (mode === "tag") {
      getReviewTags(review).forEach((tag) => {
        if (normalizedQuery && !tag.name.toLowerCase().includes(normalizedQuery)) {
          return
        }

        options.set(`tag:${tag.id}`, {
          id: tag.id,
          label: tag.name,
          mode,
        })
      })
      return
    }

    const id = mode === "theater" ? review.theater.id : review.performance?.id
    const rawLabel = mode === "theater" ? review.theater.name : getWorkLabel(review)
    const label = mode === "theater" ? getCanonicalTheaterName(rawLabel) : rawLabel
    const hasSeatMap = mode === "theater" ? theaterSeatMapNames.has(label) : false

    if (!id || !rawLabel || !label) {
      return
    }

    if (
      normalizedQuery &&
      !label.toLowerCase().includes(normalizedQuery) &&
      !rawLabel.toLowerCase().includes(normalizedQuery)
    ) {
      return
    }

    const key = `${mode}:${label}`
    const existing = options.get(key)

    options.set(key, {
      id: existing?.id ?? id,
      label,
      mode,
      hasSeatMap: existing?.hasSeatMap || hasSeatMap,
      aliases: Array.from(new Set([...(existing?.aliases ?? []), rawLabel, label])),
    })
  })

  if (mode === "theater") {
    theaterSeatMapOptions.forEach((theater) => {
      const label = getCanonicalTheaterName(theater.label)

      if (normalizedQuery && !label.toLowerCase().includes(normalizedQuery)) {
        return
      }

      if (options.has(`${mode}:${label}`)) {
        const existing = options.get(`${mode}:${label}`)

        if (existing) {
          options.set(`${mode}:${label}`, {
            ...existing,
            aliases: Array.from(new Set([...(existing.aliases ?? []), theater.label, label])),
            hasSeatMap: true,
          })
        }
        return
      }

      options.set(`${mode}:${label}`, {
        id: theater.id,
        label,
        mode,
        aliases: [theater.label, label],
        hasSeatMap: true,
      })
    })
  }

  return Array.from(options.values())
}

function parseRange(value: string) {
  const numbers = value.match(/\d+/g)?.map(Number)

  if (!numbers?.length) {
    return null
  }

  if (numbers.length === 1) {
    return { min: numbers[0], max: numbers[0] }
  }

  return {
    min: Math.min(numbers[0], numbers[1]),
    max: Math.max(numbers[0], numbers[1]),
  }
}

function matchesRange(value: string, rangeText: string) {
  const normalizedRangeText = rangeText.trim()

  if (!normalizedRangeText) {
    return true
  }

  const range = parseRange(normalizedRangeText)
  const numericValue = Number(value)

  if (!range || Number.isNaN(numericValue)) {
    return value.trim().toLowerCase() === normalizedRangeText.toLowerCase()
  }

  return numericValue >= range.min && numericValue <= range.max
}

export default function ReviewBoardPage() {
  const navigate = useNavigate()
  const { reviews, isLoading, error, removeReview } = useSeatReviews()
  const [authToken, setAuthToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(null)
  const [searchText, setSearchText] = useState("")
  const [activeFilterMode, setActiveFilterMode] = useState<FilterMode | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>("theater")
  const [filterSearchText, setFilterSearchText] = useState("")
  const [selectedFilter, setSelectedFilter] = useState<ReviewBoardFilter | null>(null)
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("latest")
  const [seatFilter, setSeatFilter] = useState<SeatFilter>(initialSeatFilter)
  const [viewMode, setViewMode] = useState<ViewMode>("board")
  const [selectedReview, setSelectedReview] = useState<PublicSeatReview | null>(null)
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState("")

  const filterOptions = useMemo(
    () => makeUniqueFilters(reviews, filterMode, filterSearchText),
    [filterMode, filterSearchText, reviews],
  )

  const seatFilterScopeReviews = useMemo(
    () => getSeatFilterScopeReviews(reviews, { searchText, selectedFilter }),
    [reviews, searchText, selectedFilter],
  )

  const floorOptions = useMemo(
    () => getSortedUniqueSeatValues(seatFilterScopeReviews, (review) => review.seat.floor),
    [seatFilterScopeReviews],
  )

  const sectionOptions = useMemo(
    () => getSortedUniqueSeatValues(seatFilterScopeReviews, (review) => review.seat.section),
    [seatFilterScopeReviews],
  )

  const canShowSeatMap = Boolean(selectedFilter?.mode === "theater" && selectedFilter.hasSeatMap)
  const effectiveViewMode: ViewMode = viewMode === "seatMap" && canShowSeatMap ? "seatMap" : "board"
  const effectiveSeatFilter = useMemo<SeatFilter>(
    () => ({
      ...seatFilter,
      floor:
        seatFilter.floor && !floorOptions.includes(seatFilter.floor) ? "" : seatFilter.floor,
      section:
        seatFilter.section && !sectionOptions.includes(seatFilter.section)
          ? ""
          : seatFilter.section,
    }),
    [floorOptions, seatFilter, sectionOptions],
  )
  const seatFilterHint = selectedFilter
    ? `${selectedFilter.label} 기준으로 가능한 위치만 표시합니다.`
    : "극장이나 작품을 선택하면 해당 범위의 위치만 표시합니다."

  const visibleReviews = useMemo(() => {
    return seatFilterScopeReviews
      .filter((review) => {
        if (effectiveSeatFilter.floor && review.seat.floor !== effectiveSeatFilter.floor) {
          return false
        }

        if (effectiveSeatFilter.section && review.seat.section !== effectiveSeatFilter.section) {
          return false
        }

        if (!matchesRange(review.seat.row, effectiveSeatFilter.rowRange)) {
          return false
        }

        return matchesRange(review.seat.number, effectiveSeatFilter.numberRange)
      })
      .sort((a, b) => {
        const difference = getSortValue(b, sortKey) - getSortValue(a, sortKey)
        return isAscendingSort(sortKey) ? -difference : difference
      })
  }, [seatFilterScopeReviews, effectiveSeatFilter, sortKey])

  const displayReviews = getReviewBoardDisplayReviews({
    viewMode: effectiveViewMode,
    visibleReviews,
    seatMapReviews: seatFilterScopeReviews,
  })

  useEffect(() => {
    if (!authToken) {
      return
    }

    let isMounted = true
    const token = authToken

    async function loadCurrentUser() {
      try {
        const user = await getCurrentUser(token)

        if (isMounted) {
          setCurrentUser(user)
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY)

        if (isMounted) {
          setAuthToken(null)
          setCurrentUser(null)
        }
      }
    }

    void loadCurrentUser()

    return () => {
      isMounted = false
    }
  }, [authToken])

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

  useEffect(() => {
    if (!isLogoutConfirmOpen) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsLogoutConfirmOpen(false)
      }
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [isLogoutConfirmOpen])

  function handleWriteReview() {
    if (authToken) {
      navigate("/reviews/new")
      return
    }

    navigate("/auth", { state: { redirectTo: "/reviews/new" } })
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY)
    setAuthToken(null)
    setCurrentUser(null)
    setIsLogoutConfirmOpen(false)
  }

  function handleEditReview(review: PublicSeatReview) {
    navigate(`/reviews/${review.id}/edit`)
  }

  async function handleDeleteReview(review: PublicSeatReview) {
    if (!authToken) {
      navigate("/auth", { state: { redirectTo: "/" } })
      return
    }

    if (!window.confirm("정말 이 후기를 삭제하시겠습니까?")) {
      return
    }

    try {
      setActionError("")
      await deleteSeatReview(review.id, authToken)
      removeReview(review.id)

      if (selectedReview?.id === review.id) {
        setSelectedReview(null)
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "후기 삭제에 실패했습니다.")
    }
  }

  function handleFilterModeChange(nextMode: FilterMode) {
    setActiveFilterMode(nextMode)
    setFilterMode(nextMode)
    setFilterSearchText("")
    setSelectedFilter(null)
  }

  return (
    <main className="review-board-page">
      <div className="review-board-shell">
        <header className="review-board-header">
          <h1>게시판</h1>
          <div className="review-board-auth-actions">
            {authToken ? (
              <button type="button" onClick={() => setIsLogoutConfirmOpen(true)}>
                로그아웃
              </button>
            ) : (
              <button type="button" onClick={() => navigate("/auth", { state: { redirectTo: "/" } })}>
                로그인
              </button>
            )}
          </div>
        </header>

        <section className="review-board-search-row">
          <input
            className="review-board-main-search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="후기 내용을 검색하세요"
          />
          <button className="review-board-write-button" type="button" onClick={handleWriteReview}>
            후기 작성
          </button>
        </section>

        <section className="review-board-filter-panel">
          <div className="review-board-filter-row">
            <button
              className="review-board-chip"
              type="button"
              aria-pressed={activeFilterMode === "theater"}
              onClick={() => handleFilterModeChange("theater")}
            >
              극장별
            </button>
            <button
              className="review-board-chip"
              type="button"
              aria-pressed={activeFilterMode === "work"}
              onClick={() => handleFilterModeChange("work")}
            >
              작품별
            </button>
            <button
              className="review-board-chip"
              type="button"
              aria-pressed={activeFilterMode === "tag"}
              onClick={() => handleFilterModeChange("tag")}
            >
              태그별
            </button>
            {activeFilterMode ? (
              <input
                className="review-board-filter-search"
                value={filterSearchText}
                onChange={(event) => setFilterSearchText(event.target.value)}
                placeholder="검색어를 입력하세요"
              />
            ) : null}
          </div>

          {activeFilterMode && filterSearchText.trim() ? (
            <div className="review-board-filter-result-zone">
              <p>{filterResultLabels[activeFilterMode]}</p>
              <div className="review-board-filter-results">
                {filterOptions.length > 0 ? (
                  filterOptions.map((option) => (
                    <button
                      key={`${option.mode}:${option.id}`}
                      className="review-board-filter-result"
                      type="button"
                      aria-pressed={
                        selectedFilter?.mode === option.mode && selectedFilter.id === option.id
                      }
                      onClick={() => {
                        setSelectedFilter(option)
                        setFilterSearchText(option.label)

                        if (option.mode === "theater" && option.hasSeatMap) {
                          setIsSortOpen(false)
                          setViewMode("seatMap")
                        }
                      }}
                    >
                      {option.label}
                    </button>
                  ))
                ) : (
                  <p className="review-board-empty-filter">검색 결과가 없습니다.</p>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <section className="review-board-list-panel">
          <div className="review-board-view-tabs">
            <button
              type="button"
              aria-pressed={effectiveViewMode === "board"}
              onClick={() => setViewMode("board")}
            >
              게시판
            </button>
            {canShowSeatMap ? (
              <button
                type="button"
                aria-pressed={effectiveViewMode === "seatMap"}
                onClick={() => {
                  setIsSortOpen(false)
                  setViewMode("seatMap")
                }}
              >
                좌석배치도
              </button>
            ) : null}
          </div>

          {effectiveViewMode === "board" ? (
            <div className="review-board-list-toolbar">
              <button
                className="review-board-sort-button"
                type="button"
                aria-expanded={isSortOpen}
                onClick={() => setIsSortOpen((isOpen) => !isOpen)}
              >
                <span />
                <span />
                <span />
              </button>

              {isSortOpen ? (
                <div className="review-board-sort-menu">
                <section>
                  <h3>정렬</h3>
                  <div className="review-board-sort-options">
                    {sortGroups.map((group) => (
                      <div className="review-board-sort-group" key={group.label}>
                        <span>{group.label}</span>
                        <div>
                          {group.keys.map((key) => (
                            <button
                              key={key}
                              type="button"
                              aria-pressed={sortKey === key}
                              onClick={() => setSortKey(key)}
                            >
                              {sortLabels[key]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h3>좌석 필터</h3>
                  <p className="review-board-filter-hint">{seatFilterHint}</p>
                  <div className="review-board-seat-filter-group">
                    <span>층수</span>
                    <div>
                      {floorOptions.map((floor) => (
                        <button
                          key={floor}
                          type="button"
                          aria-pressed={effectiveSeatFilter.floor === floor}
                          onClick={() =>
                            setSeatFilter({
                              ...effectiveSeatFilter,
                              floor: effectiveSeatFilter.floor === floor ? "" : floor,
                            })
                          }
                        >
                          {floor}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="review-board-seat-filter-group">
                    <span>구역</span>
                    <div>
                      {sectionOptions.map((section) => (
                        <button
                          key={section}
                          type="button"
                          aria-pressed={effectiveSeatFilter.section === section}
                          onClick={() =>
                            setSeatFilter({
                              ...effectiveSeatFilter,
                              section: effectiveSeatFilter.section === section ? "" : section,
                            })
                          }
                        >
                          {section}구역
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="review-board-range-filters">
                    <label>
                      열
                      <input
                        value={effectiveSeatFilter.rowRange}
                        onChange={(event) =>
                          setSeatFilter({ ...effectiveSeatFilter, rowRange: event.target.value })
                        }
                        placeholder="3~6"
                      />
                    </label>
                    <label>
                      번호
                      <input
                        value={effectiveSeatFilter.numberRange}
                        onChange={(event) =>
                          setSeatFilter({ ...effectiveSeatFilter, numberRange: event.target.value })
                        }
                        placeholder="3~6"
                      />
                    </label>
                  </div>
                </section>

                <div className="review-board-sort-actions">
                  <button type="button" onClick={() => setSeatFilter(initialSeatFilter)}>
                    초기화
                  </button>
                  <button type="button" onClick={() => setIsSortOpen(false)}>
                    적용
                  </button>
                </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {isLoading ? <p className="review-board-state">후기 목록을 불러오는 중입니다.</p> : null}
          {error ? <p className="review-board-state review-board-state--error">{error}</p> : null}
          {actionError ? (
            <p className="review-board-state review-board-state--error">{actionError}</p>
          ) : null}

          {!isLoading && !error ? (
            effectiveViewMode === "seatMap" && selectedFilter?.mode === "theater" ? (
              <Suspense fallback={<p className="review-board-state">좌석배치도를 불러오는 중입니다.</p>}>
                <TheaterSeatMap
                  currentUserId={currentUser?.id}
                  onDeleteReview={handleDeleteReview}
                  onEditReview={handleEditReview}
                  reviews={displayReviews}
                  theaterName={selectedFilter.label}
                />
              </Suspense>
            ) : (
              <div className="review-board-list">
                {displayReviews.length > 0 ? (
                  displayReviews.map((review) => (
                    <SeatReviewCard
                      canManage={review.author.id === currentUser?.id}
                      key={review.id}
                      onDelete={handleDeleteReview}
                      onEdit={handleEditReview}
                      review={review}
                      onSelect={setSelectedReview}
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
              review={selectedReview}
              variant="detail"
            />
            <ReviewComments
              authToken={authToken}
              currentUserId={currentUser?.id}
              reviewId={selectedReview.id}
            />
          </section>
        </div>
      ) : null}

      {isLogoutConfirmOpen ? (
        <div
          className="logout-confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsLogoutConfirmOpen(false)
            }
          }}
        >
          <section className="logout-confirm-card">
            <h2 id="logout-confirm-title">로그아웃 하시겠습니까?</h2>
            <p>현재 계정에서 로그아웃됩니다.</p>
            <div className="logout-confirm-actions">
              <button type="button" onClick={() => setIsLogoutConfirmOpen(false)}>
                취소
              </button>
              <button type="button" onClick={handleLogout}>
                로그아웃
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  )
}
