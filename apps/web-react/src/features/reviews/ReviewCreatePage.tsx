import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import DraftPayloadPreview from "./components/DraftPayloadPreview"
import MetadataSelects from "./components/MetadataSelects"
import SeatLocationFields from "./components/SeatLocationFields"
import { useReviewMetadata } from "./hooks/useReviewMetadata"
import type { ReviewDraftPayload, SeatLocationDraft } from "./types"

function normalizeSeatText(value: string) {
  return value.trim()
}

function normalizeSeatToken(value: string) {
  return value.trim().toUpperCase()
}

const initialSeatLocation: SeatLocationDraft = {
  seatFloor: "",
  seatSection: "",
  seatRow: "",
  seatNumber: "",
}

export default function ReviewCreatePage() {
  const [selectedTheaterId, setSelectedTheaterId] = useState("")
  const [selectedMusicalId, setSelectedMusicalId] = useState("")
  const [selectedPerformanceId, setSelectedPerformanceId] = useState("")
  const [seatLocation, setSeatLocation] = useState<SeatLocationDraft>(initialSeatLocation)
  const [previewPayload, setPreviewPayload] = useState<ReviewDraftPayload | null>(null)

  const {
    theaters,
    musicals,
    performances,
    isLoadingMetadata,
    isLoadingPerformances,
    error,
  } = useReviewMetadata(selectedTheaterId, selectedMusicalId)

  useEffect(() => {
    setSelectedPerformanceId("")
  }, [selectedTheaterId, selectedMusicalId])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const payload: ReviewDraftPayload = {
      theaterId: selectedTheaterId,
      musicalId: selectedMusicalId,
      performanceId: selectedPerformanceId,
      seatFloor: normalizeSeatToken(seatLocation.seatFloor),
      seatSection: normalizeSeatToken(seatLocation.seatSection),
      seatRow: normalizeSeatToken(seatLocation.seatRow),
      seatNumber: normalizeSeatText(seatLocation.seatNumber),
    }

    setPreviewPayload(payload)
  }

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1>좌석 리뷰 작성</h1>

      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {isLoadingMetadata ? <p>공연장과 작품 목록을 불러오는 중입니다.</p> : null}

      <form onSubmit={handleSubmit}>
        <MetadataSelects
          theaters={theaters}
          musicals={musicals}
          performances={performances}
          selectedTheaterId={selectedTheaterId}
          selectedMusicalId={selectedMusicalId}
          selectedPerformanceId={selectedPerformanceId}
          isLoadingPerformances={isLoadingPerformances}
          onChangeTheaterId={setSelectedTheaterId}
          onChangeMusicalId={setSelectedMusicalId}
          onChangePerformanceId={setSelectedPerformanceId}
        />

        <SeatLocationFields value={seatLocation} onChange={setSeatLocation} />

        <button type="submit">작성 값 확인</button>
      </form>

      <DraftPayloadPreview payload={previewPayload} />
    </main>
  )
}
