import type { MusicalOption, PerformanceOption, TheaterOption } from "../types"

type MetadataSelectsProps = {
  theaters: TheaterOption[]
  musicals: MusicalOption[]
  performances: PerformanceOption[]
  selectedTheaterId: string
  selectedMusicalId: string
  selectedPerformanceId: string
  isLoadingPerformances: boolean
  onChangeTheaterId: (value: string) => void
  onChangeMusicalId: (value: string) => void
  onChangePerformanceId: (value: string) => void
}

export default function MetadataSelects({
  theaters,
  musicals,
  performances,
  selectedTheaterId,
  selectedMusicalId,
  selectedPerformanceId,
  isLoadingPerformances,
  onChangeTheaterId,
  onChangeMusicalId,
  onChangePerformanceId,
}: MetadataSelectsProps) {
  return (
    <section>
      <label>
        공연장
        <select value={selectedTheaterId} onChange={(event) => onChangeTheaterId(event.target.value)}>
          <option value="">공연장을 선택하세요</option>
          {theaters.map((theater) => (
            <option key={theater.id} value={theater.id}>
              {theater.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        작품
        <select value={selectedMusicalId} onChange={(event) => onChangeMusicalId(event.target.value)}>
          <option value="">작품을 선택하세요</option>
          {musicals.map((musical) => (
            <option key={musical.id} value={musical.id}>
              {musical.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        공연 조합
        <select value={selectedPerformanceId} onChange={(event) => onChangePerformanceId(event.target.value)}>
          <option value="">공연 조합을 선택하세요</option>
          {performances.map((performance) => (
            <option key={performance.id} value={performance.id}>
              {performance.theaterName} / {performance.musicalTitle}
            </option>
          ))}
        </select>
      </label>

      {isLoadingPerformances ? <p>공연 목록을 불러오는 중입니다.</p> : null}
    </section>
  )
}
