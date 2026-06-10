import { apiRequest } from "../../shared/api"
import type { MusicalOption, PerformanceOption, TheaterOption } from "./types"

export function getTheaters() {
  return apiRequest<TheaterOption[]>("/theaters")
}

export function getMusicals() {
  return apiRequest<MusicalOption[]>("/musicals")
}

type GetPerformancesParams = {
  theaterId?: string
  musicalId?: string
}

export function getPerformances(params: GetPerformancesParams = {}) {
  const searchParams = new URLSearchParams()

  if (params.theaterId) {
    searchParams.set("theaterId", params.theaterId)
  }

  if (params.musicalId) {
    searchParams.set("musicalId", params.musicalId)
  }

  const queryString = searchParams.toString()
  const path = queryString ? `/performances?${queryString}` : "/performances"

  return apiRequest<PerformanceOption[]>(path)
}
