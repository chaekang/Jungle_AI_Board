import { apiRequest } from "../../shared/api"
import type { PublicSeatReview, SeatReviewListResponse, CreateSeatReviewPayload, MusicalOption, PerformanceOption, TheaterOption } from "./types"

// 극장 목록 가져오기
export function getTheaters() {
  return apiRequest<TheaterOption[]>("/theaters")
}

// 뮤지컬 목록 가져오기
export function getMusicals() {
  return apiRequest<MusicalOption[]>("/musicals")
}

// 공연 타입
type GetPerformancesParams = {
  theaterId?: string
  musicalId?: string
}

// 공연 목록 가져오기
export function getPerformances(params: GetPerformancesParams = {}) {
  const searchParams = new URLSearchParams()    // 비어있는 `URLSearchParams` 객체 생성

  if (params.theaterId) {
    searchParams.set("theaterId", params.theaterId)
  }

  if (params.musicalId) {
    searchParams.set("musicalId", params.musicalId)
  }

  const queryString = searchParams.toString()   // `searchParams` 안에 있는 값을 문자열로 변환
  const path = queryString ? `/performances?${queryString}` : "/performances"

  return apiRequest<PerformanceOption[]>(path)
}

// 좌석 리뷰 생성
export function createSeatReview(input: CreateSeatReviewPayload, token: string) {
  return apiRequest<PublicSeatReview>(
    "/seat-reviews",
    {
      method: "POST",
      body: JSON.stringify(input)
    },
    token
  )
}

// 좌석 리뷰 목록 가져오기
export function getSeatReviews(params: {performanceId?: string} = {}) {
  const searchParams = new URLSearchParams()

  if (params.performanceId) {
    searchParams.set("performanceId", params.performanceId)
  }

  const queryString = searchParams.toString()
  const path = queryString ? `/seat-reviews?${queryString}`: "/seat-reviews"  // 요청 경로가 있으면 특정 리뷰 조회, 없으면 전체 목록

  return apiRequest<SeatReviewListResponse>(path)
}

// 리뷰 하나의 상세 정보 가져오기
export function getSeatReview(id: string) {
  return apiRequest<PublicSeatReview>(`/seat-reviews/${id}`)
}