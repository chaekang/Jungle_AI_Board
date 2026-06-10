import { useEffect, useMemo, useState } from "react"
import { getPerformances, getTheaters } from "../api"
import type { PerformanceOption, ReviewWorkOption, TheaterOption } from "../types"

function getDisplayTitle(performance: PerformanceOption) {
  return (
    performance.displayTitle ??
    [performance.seasonLabel, performance.musicalTitle].filter(Boolean).join(" ")
  )
}

export function useReviewMetadata(selectedTheaterId: string) {
  const [theaters, setTheaters] = useState<TheaterOption[]>([])
  const [performances, setPerformances] = useState<PerformanceOption[]>([])

  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true)
  const [isLoadingPerformances, setIsLoadingPerformances] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    async function loadMetadata() {
      try {
        setError("")
        setIsLoadingMetadata(true)

        const theaterData = await getTheaters()

        setTheaters(theaterData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "메타데이터를 불러오지 못했습니다.")
      } finally {
        setIsLoadingMetadata(false)
      }
    }

    void loadMetadata()
  }, [])

  useEffect(() => {
    if (!selectedTheaterId) {
      setPerformances([])
      setIsLoadingPerformances(false)
      return
    }

    async function loadPerformances() {
      try {
        setError("")
        setIsLoadingPerformances(true)

        const performanceData = await getPerformances({
          theaterId: selectedTheaterId,
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
  }, [selectedTheaterId])

  const workOptions = useMemo<ReviewWorkOption[]>(() => {
    return performances.map((performance) => {
      const displayTitle = getDisplayTitle(performance)

      return {
        performanceId: performance.id,
        musicalId: performance.musicalId,
        musicalTitle: performance.musicalTitle,
        seasonLabel: performance.seasonLabel,
        displayTitle,
        searchText: `${performance.musicalTitle} ${displayTitle}`.toLowerCase(),
      }
    })
  }, [performances])

  return {
    theaters,
    workOptions,
    performances,
    isLoadingMetadata,
    isLoadingPerformances,
    error,
  }
}
