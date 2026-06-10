import { useEffect, useState } from "react"
import { getMusicals, getPerformances, getTheaters } from "../api"
import type { MusicalOption, PerformanceOption, TheaterOption } from "../types"

export function useReviewMetadata(selectedTheaterId: string, selectedMusicalId: string) {
  const [theaters, setTheaters] = useState<TheaterOption[]>([])
  const [musicals, setMusicals] = useState<MusicalOption[]>([])
  const [performances, setPerformances] = useState<PerformanceOption[]>([])

  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true)
  const [isLoadingPerformances, setIsLoadingPerformances] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadMetadata() {
      try {
        setError("")
        setIsLoadingMetadata(true)

        const [theaterData, musicalData] = await Promise.all([getTheaters(), getMusicals()])

        setTheaters(theaterData)
        setMusicals(musicalData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "메타데이터를 불러오지 못했습니다.")
      } finally {
        setIsLoadingMetadata(false)
      }
    }

    void loadMetadata()
  }, [])

  useEffect(() => {
    async function loadPerformances() {
      try {
        setError("")
        setIsLoadingPerformances(true)

        const performanceData = await getPerformances({
          theaterId: selectedTheaterId,
          musicalId: selectedMusicalId,
        })

        setPerformances(performanceData)
      } catch (err) {
        setPerformances([])
        setError(err instanceof Error ? err.message : "공연 목록을 불러오지 못했습니다.")
      } finally {
        setIsLoadingPerformances(false)
      }
    }

    void loadPerformances()
  }, [selectedTheaterId, selectedMusicalId])

  return {
    theaters,
    musicals,
    performances,
    isLoadingMetadata,
    isLoadingPerformances,
    error,
  }
}
