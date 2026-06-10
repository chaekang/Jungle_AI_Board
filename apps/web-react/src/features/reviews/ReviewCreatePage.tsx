import { useEffect, useMemo, useState } from "react"
import type { FormEvent } from "react"
import DraftPayloadPreview from "./components/DraftPayloadPreview"
import MetadataSelects from "./components/MetadataSelects"
import SeatLocationFields from "./components/SeatLocationFields"
import { useReviewMetadata } from "./hooks/useReviewMetadata"
import { getTheaterSeatLayout } from "./theater-seat-layouts"
import type { ReviewDraftPayload, SeatLocationDraft, TheaterSeatLayout } from "./types"

function normalizeSeatText(value: string) {
  return value.trim()
}

function normalizeSeatRow(value: string) {
  return normalizeSeatText(value).toUpperCase()
}

function hasOfficialSections(layout: TheaterSeatLayout) {
  return Object.values(layout.sectionsByFloor).some((sections) => sections.length > 0)
}

const initialSeatLocation: SeatLocationDraft = {
  seatFloor: "",
  seatSection: "",
  seatRow: "",
  seatNumber: "",
}

export default function ReviewCreatePage() {
  const [selectedTheaterId, setSelectedTheaterId] = useState("")
  const [selectedPerformanceId, setSelectedPerformanceId] = useState("")
  const [workSearchText, setWorkSearchText] = useState("")
  const [seatLocation, setSeatLocation] = useState<SeatLocationDraft>(initialSeatLocation)
  const [previewPayload, setPreviewPayload] = useState<ReviewDraftPayload | null>(null)
  const [formError, setFormError] = useState("")

  const { theaters, workOptions, performances, isLoadingMetadata, isLoadingPerformances, error } =
    useReviewMetadata(selectedTheaterId)

  const selectedTheater = useMemo(
    () => theaters.find((theater) => theater.id === selectedTheaterId) ?? null,
    [theaters, selectedTheaterId],
  )

  const selectedPerformance = useMemo(
    () => performances.find((performance) => performance.id === selectedPerformanceId) ?? null,
    [performances, selectedPerformanceId],
  )

  const seatLayout = useMemo(() => getTheaterSeatLayout(selectedTheater), [selectedTheater])
  const needsOfficialSection = hasOfficialSections(seatLayout)

  useEffect(() => {
    setSelectedPerformanceId("")
    setWorkSearchText("")
    setSeatLocation(initialSeatLocation)
    setPreviewPayload(null)
    setFormError("")
  }, [selectedTheaterId])

  useEffect(() => {
    if (!selectedTheaterId) {
      return
    }

    if (workOptions.length === 1) {
      setSelectedPerformanceId(workOptions[0].performanceId)
      return
    }

    if (
      selectedPerformanceId &&
      !workOptions.some((work) => work.performanceId === selectedPerformanceId)
    ) {
      setSelectedPerformanceId("")
    }
  }, [selectedPerformanceId, selectedTheaterId, workOptions])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !selectedTheaterId ||
      !selectedPerformanceId ||
      !selectedPerformance ||
      !seatLocation.seatFloor ||
      (needsOfficialSection && !seatLocation.seatSection) ||
      !seatLocation.seatRow.trim() ||
      !seatLocation.seatNumber.trim()
    ) {
      setFormError("공연장, 작품, 좌석 위치를 모두 선택하거나 입력해주세요.")
      setPreviewPayload(null)
      return
    }

    const payload: ReviewDraftPayload = {
      theaterId: selectedTheaterId,
      musicalId: selectedPerformance.musicalId,
      performanceId: selectedPerformance.id,
      seatFloor: normalizeSeatText(seatLocation.seatFloor),
      seatRow: normalizeSeatRow(seatLocation.seatRow),
      seatNumber: normalizeSeatText(seatLocation.seatNumber),
      ...(needsOfficialSection
        ? { seatSection: normalizeSeatText(seatLocation.seatSection) }
        : {}),
    }

    setFormError("")
    setPreviewPayload(payload)
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1>좌석 리뷰 작성</h1>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {formError ? <p style={{ color: "crimson" }}>{formError}</p> : null}
      {isLoadingMetadata ? <p>공연장 목록을 불러오는 중입니다.</p> : null}

      <form onSubmit={handleSubmit}>
        <MetadataSelects
          theaters={theaters}
          workOptions={workOptions}
          selectedTheaterId={selectedTheaterId}
          selectedPerformanceId={selectedPerformanceId}
          selectedPerformance={selectedPerformance}
          workSearchText={workSearchText}
          isLoadingPerformances={isLoadingPerformances}
          onChangeTheaterId={setSelectedTheaterId}
          onChangePerformanceId={setSelectedPerformanceId}
          onChangeWorkSearchText={setWorkSearchText}
        />

        <SeatLocationFields
          value={seatLocation}
          layout={seatLayout}
          disabled={!selectedTheaterId}
          onChange={setSeatLocation}
        />

        <button type="submit">작성 값 확인</button>
      </form>

      <DraftPayloadPreview payload={previewPayload} />
    </main>
  )
}
