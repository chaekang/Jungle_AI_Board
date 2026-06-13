import type { SeatReviewSearchParams, SeatReviewSearchSort } from "./types";

export type ReviewBoardSearchFilter = {
  id: string;
  label: string;
  mode: "theater" | "work" | "tag";
};

export type ReviewBoardSortKey =
  | "latest"
  | "oldest"
  | "popular"
  | "rating"
  | "viewHigh"
  | "soundHigh"
  | "comfortHigh"
  | "expressionHigh"
  | "stageVisibilityHigh";

export type ReviewBoardSeatFilter = {
  floor: string;
  section: string;
  row: string;
  number: string;
};

export type ReviewBoardSearchState = {
  page: number;
  limit: number;
  searchText: string;
  activeFilterMode?: ReviewBoardSearchFilter["mode"] | null;
  filterSearchText?: string;
  selectedFilter: ReviewBoardSearchFilter | null;
  seatFilter: ReviewBoardSeatFilter;
  sortKey: ReviewBoardSortKey;
};

const sortKeyToApiSort: Record<ReviewBoardSortKey, SeatReviewSearchSort> = {
  latest: "latest",
  oldest: "oldest",
  popular: "popular",
  rating: "rating",
  viewHigh: "view",
  soundHigh: "sound",
  comfortHigh: "comfort",
  expressionHigh: "expression",
  stageVisibilityHigh: "stageVisibility",
};

const searchParamOrder: Array<keyof SeatReviewSearchParams> = [
  "page",
  "limit",
  "q",
  "theaterId",
  "theater",
  "musicalId",
  "musical",
  "performanceId",
  "seasonLabel",
  "seatFloor",
  "seatSection",
  "seatRow",
  "seatNumber",
  "tagId",
  "tag",
  "hasObstruction",
  "minViewRating",
  "minSoundRating",
  "minComfortRating",
  "minExpressionRating",
  "minStageVisibilityRating",
  "sort",
];

function normalizeText(value: string) {
  return value.trim();
}

export function buildSeatReviewSearchQuery(
  state: ReviewBoardSearchState,
): SeatReviewSearchParams {
  const query: SeatReviewSearchParams = {
    page: state.page,
    limit: state.limit,
  };
  const q = normalizeText(state.searchText);
  const { selectedFilter, seatFilter } = state;

  if (q) {
    query.q = q;
  }

  if (selectedFilter?.mode === "theater") {
    query.theater = selectedFilter.label;
  }

  if (selectedFilter?.mode === "work") {
    query.performanceId = selectedFilter.id;
  }

  if (selectedFilter?.mode === "tag") {
    query.tagId = selectedFilter.id;
  }

  const filterText = normalizeText(state.filterSearchText ?? "");

  if (!selectedFilter && filterText && state.activeFilterMode === "theater") {
    query.theater = filterText;
  }

  if (!selectedFilter && filterText && state.activeFilterMode === "work") {
    query.musical = filterText;
  }

  if (!selectedFilter && filterText && state.activeFilterMode === "tag") {
    query.tag = filterText;
  }

  if (seatFilter.floor) {
    query.seatFloor = seatFilter.floor;
  }

  if (seatFilter.section) {
    query.seatSection = seatFilter.section;
  }

  if (seatFilter.row) {
    query.seatRow = normalizeText(seatFilter.row);
  }

  if (seatFilter.number) {
    query.seatNumber = normalizeText(seatFilter.number);
  }

  query.sort = sortKeyToApiSort[state.sortKey];

  return query;
}

export function buildSeatReviewSearchPath(params: SeatReviewSearchParams): string;
export function buildSeatReviewSearchPath(state: ReviewBoardSearchState): string;
export function buildSeatReviewSearchPath(
  input: SeatReviewSearchParams | ReviewBoardSearchState,
) {
  const query = "seatFilter" in input ? buildSeatReviewSearchQuery(input) : input;
  const searchParams = new URLSearchParams();

  searchParamOrder.forEach((key) => {
    const value = query[key];

    if (value === undefined || value === null || value === "") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const queryString = searchParams.toString();
  return queryString ? `/seat-reviews/search?${queryString}` : "/seat-reviews/search";
}
