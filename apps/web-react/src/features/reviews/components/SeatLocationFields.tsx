import type { SeatLocationDraft } from "../types"

type SeatLocationFieldsProps = {
  value: SeatLocationDraft
  onChange: (value: SeatLocationDraft) => void
}

export default function SeatLocationFields({ value, onChange }: SeatLocationFieldsProps) {
  return (
    <section>
      <label>
        층
        <input
          value={value.seatFloor}
          onChange={(event) => onChange({ ...value, seatFloor: event.target.value })}
          placeholder="1F"
        />
      </label>

      <label>
        구역
        <input
          value={value.seatSection}
          onChange={(event) => onChange({ ...value, seatSection: event.target.value })}
          placeholder="CENTER"
        />
      </label>

      <label>
        열
        <input
          value={value.seatRow}
          onChange={(event) => onChange({ ...value, seatRow: event.target.value })}
          placeholder="F"
        />
      </label>

      <label>
        번호
        <input
          value={value.seatNumber}
          onChange={(event) => onChange({ ...value, seatNumber: event.target.value })}
          placeholder="18"
        />
      </label>
    </section>
  )
}
