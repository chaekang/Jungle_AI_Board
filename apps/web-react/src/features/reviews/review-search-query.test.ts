import {
  buildSeatReviewSearchPath,
  buildSeatReviewSearchQuery,
  type ReviewBoardSearchState,
} from "./review-search-query.ts";

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const state: ReviewBoardSearchState = {
  page: 3,
  limit: 12,
  searchText: "블루",
  selectedFilter: {
    id: "tag-1",
    label: "시야방해",
    mode: "tag",
  },
  seatFilter: {
    floor: "1층",
    section: "A",
    row: "7",
    number: "15",
  },
  sortKey: "stageVisibilityHigh",
};

assertDeepEqual(buildSeatReviewSearchQuery(state), {
  page: 3,
  limit: 12,
  q: "블루",
  tagId: "tag-1",
  seatFloor: "1층",
  seatSection: "A",
  seatRow: "7",
  seatNumber: "15",
  sort: "stageVisibility",
});

assertEqual(
  buildSeatReviewSearchPath(state),
  "/seat-reviews/search?page=3&limit=12&q=%EB%B8%94%EB%A3%A8&seatFloor=1%EC%B8%B5&seatSection=A&seatRow=7&seatNumber=15&tagId=tag-1&sort=stageVisibility",
);

assertDeepEqual(
  buildSeatReviewSearchQuery({
    ...state,
    searchText: "지킬",
    selectedFilter: { id: "performance-1", label: "2024-2025 지킬 앤 하이드", mode: "work" },
    sortKey: "latest",
  }),
  {
    page: 3,
    limit: 12,
    q: "지킬",
    performanceId: "performance-1",
    seatFloor: "1층",
    seatSection: "A",
    seatRow: "7",
    seatNumber: "15",
    sort: "latest",
  },
);

assertDeepEqual(
  buildSeatReviewSearchQuery({
    ...state,
    searchText: "",
    selectedFilter: null,
    activeFilterMode: "theater",
    filterSearchText: "샤롯데",
  }),
  {
    page: 3,
    limit: 12,
    theater: "샤롯데",
    seatFloor: "1층",
    seatSection: "A",
    seatRow: "7",
    seatNumber: "15",
    sort: "stageVisibility",
  },
);

console.log("review-search-query tests passed.");
