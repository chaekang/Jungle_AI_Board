export type TheaterOption = {
  id: string
  name: string
}

export type MusicalOption = {
  id: string
  name: string
}

export type PerformanceOption = {
  id: string
  theaterId: string
  theaterName: string
  musicalId: string
  musicalTitle: string
}

export type SeatLocationDraft = {
  seatFloor: string
  seatSection: string
  seatRow: string
  seatNumber: string
}

export type ReviewDraftPayload = {
  theaterId: string
  musicalId: string
  performanceId: string
} & SeatLocationDraft
