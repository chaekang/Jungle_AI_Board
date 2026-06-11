// 리뷰 작성 화면에서 사용하는 데이터 모양을 정리해둔 파일

// 극장 선택 목록
export type TheaterOption = {
  id: string
  name: string
}

// 뮤지컬 선택 목록
export type MusicalOption = {
  id: string
  name: string
}

// 공연 선택 목록
export type PerformanceOption = {
  id: string
  theaterId: string
  theaterName: string
  musicalId: string
  musicalTitle: string
  seasonLabel?: string | null
  displayTitle?: string
}

// 작품 select에 보여줄 공연 시즌 선택지
export type ReviewWorkOption = {
  performanceId: string
  musicalId: string
  musicalTitle: string
  seasonLabel?: string | null
  displayTitle: string
  searchText: string
}

// 좌석 선택 버튼 하나의 모양
export type SeatOption = {
  value: string
  label: string
}

// 공연장별 좌석 층/구역 선택지
export type TheaterSeatLayout = {
  floors: SeatOption[]
  sectionsByFloor: Record<string, SeatOption[]>
  aiBlocksByFloor?: Record<string, SeatOption[]>
}

// 사용자가 입력 중인 좌석 위치 정보
export type SeatLocationDraft = {
  seatFloor: string
  seatSection: string
  seatRow: string
  seatNumber: string
}

// 리뷰 작성 버튼을 누르면 서버로 보낼 데이터 모양
export type ReviewDraftPayload = {
  theaterId: string
  musicalId: string
  performanceId: string
  seatFloor: string
  seatSection?: string
  seatRow: string
  seatNumber: string
}

// 리뷰 평점 정보
export type ReviewRatingDraft = {
  viewRating: number;
  soundRating: number;
  comfortRating: number;
  expressionRating: number;
  stageVisibilityRating: number;
}

// 평점과 본문을 더한 최종 POST body
export type CreateSeatReviewPayload = ReviewDraftPayload & 
  ReviewRatingDraft & {
    content: string;
  }

// 서버 응답 타입
export type PublicSeatReview = {
  id: string;
  author: {
    id: string;
    nickname: string;
  }
  theater: {
    id: string;
    name: string;
  }
  musical: {
    id: string;
    title: string;
  }
  performance: {
    id: string;
    seasonLabel?: string | null;
  } | null
  seat: {
    floor: string;
    section?: string | null;
    row: string;
    number: string;
  }
  ratings: {
    view: number;
    sound: number;
    comfort: number;
    expression: number;
    stageVisibility: number;
  }
  content: string;
  createdAt: string;
  updatedAt: string;
}

// 리뷰 목록 API 응답 타입
export type SeatReviewListResponse = {
  items: PublicSeatReview[];
  total: number;
  page: number;
  limit: number;
}