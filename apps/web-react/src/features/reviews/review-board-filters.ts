import { getCanonicalTheaterName } from "./theater-seat-map-index.ts";
import type { PublicSeatReview } from "./types";

export type ReviewBoardFilter = {
  id: string;
  label: string;
  mode: "theater" | "work" | "tag";
  hasSeatMap?: boolean;
  aliases?: string[];
};

export function getReviewTags(review: PublicSeatReview) {
  return review.tags ?? [];
}

function getSearchText(review: PublicSeatReview) {
  return [review.content, ...getReviewTags(review).map((tag) => tag.name)].join(" ").toLowerCase();
}

export function matchesReviewBoardFilter(
  review: PublicSeatReview,
  selectedFilter: ReviewBoardFilter | null,
) {
  if (!selectedFilter) {
    return true;
  }

  if (selectedFilter.mode === "theater") {
    const canonicalTheaterName = getCanonicalTheaterName(review.theater.name);

    return (
      review.theater.id === selectedFilter.id ||
      canonicalTheaterName === selectedFilter.label ||
      Boolean(selectedFilter.aliases?.includes(review.theater.name))
    );
  }

  if (selectedFilter.mode === "work") {
    return review.performance?.id === selectedFilter.id;
  }

  return getReviewTags(review).some((tag) => tag.id === selectedFilter.id);
}

export function getSeatFilterScopeReviews(
  reviews: PublicSeatReview[],
  input: {
    searchText: string;
    selectedFilter: ReviewBoardFilter | null;
  },
) {
  const normalizedSearchText = input.searchText.trim().toLowerCase();

  return reviews.filter((review) => {
    if (normalizedSearchText && !getSearchText(review).includes(normalizedSearchText)) {
      return false;
    }

    return matchesReviewBoardFilter(review, input.selectedFilter);
  });
}

function getFirstNumber(value: string) {
  return value.match(/\d+/)?.[0];
}

function compareSeatValues(a: string, b: string) {
  const aNumber = getFirstNumber(a);
  const bNumber = getFirstNumber(b);

  if (aNumber && bNumber && Number(aNumber) !== Number(bNumber)) {
    return Number(aNumber) - Number(bNumber);
  }

  if (aNumber && !bNumber) {
    return -1;
  }

  if (!aNumber && bNumber) {
    return 1;
  }

  return a.localeCompare(b, "ko-KR", { numeric: true, sensitivity: "base" });
}

export function getSortedUniqueSeatValues(
  reviews: PublicSeatReview[],
  getValue: (review: PublicSeatReview) => string | null | undefined,
) {
  return Array.from(
    new Set(reviews.map((review) => getValue(review)?.trim()).filter(Boolean) as string[]),
  ).sort(compareSeatValues);
}

export function getReviewBoardDisplayReviews<T>(input: {
  viewMode: "board" | "seatMap";
  visibleReviews: T[];
  seatMapReviews: T[];
}) {
  return input.viewMode === "seatMap" ? input.seatMapReviews : input.visibleReviews;
}
